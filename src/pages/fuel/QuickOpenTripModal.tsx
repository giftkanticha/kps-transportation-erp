import { useState } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import type { Vehicle, Employee, Dispatch as DispatchJob, DispatchLeg, FuelTransaction } from '../../types'

interface Props {
  vehicleId: string
  date: string
  floatingTxId: string
  onClose: () => void
  onSuccess: (tripCode: string) => void
}

function thaiDate(iso: string) {
  const d = new Date(iso)
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function QuickOpenTripModal({ vehicleId, date, floatingTxId, onClose, onSuccess }: Props) {
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatches = [] } = useDispatches()
  const insertDispatch = useInsert<DispatchJob>('dispatch')
  const insertLeg = useInsert<DispatchLeg>('dispatch_legs')
  const updateFuelTx = useUpdate<FuelTransaction>('fuel_transactions')

  const vehicle = vehicles.find(v => v.id === vehicleId) ?? null
  const driver = vehicle?.driverId ? employees.find(e => e.id === vehicle.driverId) ?? null : null
  const lastMileage = db.lastClosedMileage(vehicleId, dispatches)
  const minMileage = lastMileage ?? 0

  const [odometer, setOdometer] = useState(lastMileage != null ? String(lastMileage) : '')
  const [origin, setOrigin] = useState('โรงงาน KPS')
  const [destination, setDestination] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (saving) return
    const odo = odometer.trim() === '' ? NaN : Number(odometer)
    if (!odometer || isNaN(odo) || odo < 0) {
      setError('กรุณากรอกเลขไมล์เริ่มต้น (km)')
      return
    }
    if (lastMileage != null && odo < lastMileage) {
      setError(`เลขไมล์ต้อง ≥ ${lastMileage.toLocaleString()} (ไมล์ปิดรอบก่อนหน้า)`)
      return
    }
    setError(null)
    setSaving(true)

    try {
      const code = db.nextRoundCode(dispatches)
      const created = await insertDispatch.mutateAsync({
        code,
        customerId: null,
        driverId: vehicle?.driverId ?? null,
        vehicleId,
        subcontractorId: null,
        date,
        depart: `${date}T06:00`,
        eta: `${date}T18:00`,
        status: 'scheduled',
        progress: 0,
        startOdometer: odo,
        endOdometer: null,
        distance: null,
        liters: null,
        kmPerL: null,
        perDiem: null,
        notes: 'เปิดจาก QuickOpenTripModal (Express Fuel Log)',
        totalAmount: 0,
        revenue: 0,
        cost: 0,
        roundStatus: 'draft',
        otherExpenses: [],
      })

      if (destination) {
        await insertLeg.mutateAsync({
          dispatchId: created.id,
          sortOrder: 0,
          origin,
          destination,
          cargo: '',
          cargoType: '',
          priceMode: 'lump',
          weight: 0,
          price: 0,
          amount: 0,
          legType: 'outbound',
          deliveredWeight: null,
          perDiem: 0,
          closed: false,
        })
      }

      // Link the floating FuelTransaction to this new trip
      await updateFuelTx.mutateAsync({
        id: floatingTxId,
        patch: { tripId: created.id, status: 'TRIP_LINKED' },
      })

      onSuccess(code)
    } catch (e) {
      setError('บันทึกไม่สำเร็จ: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#F8FAFC',
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🚚 เปิดรอบงานด่วน</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9CA3AF', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Vehicle info */}
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
            padding: '10px 14px', display: 'flex', gap: 16, fontSize: 13,
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>ทะเบียนรถ</div>
              <div style={{ fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace', marginTop: 2 }}>
                {vehicle?.plate ?? '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>วันที่</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{thaiDate(date)}</div>
            </div>
            {driver && (
              <div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>พนักงานขับรถ</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{driver.name}</div>
              </div>
            )}
          </div>

          {/* Form fields */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
              ต้นทาง
            </label>
            <input
              type="text"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              placeholder="ต้นทาง..."
              style={{
                width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px',
                border: '1px solid var(--line)', borderRadius: 7, fontSize: 13,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
              ปลายทาง <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(ไม่บังคับ)</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="ปลายทาง..."
              style={{
                width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px',
                border: '1px solid var(--line)', borderRadius: 7, fontSize: 13,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
              เลขไมล์เริ่มต้น (km) <span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>
            </label>
            <input
              type="number"
              min={minMileage}
              step="1"
              value={odometer}
              onChange={e => { setOdometer(e.target.value); if (error) setError(null) }}
              placeholder={lastMileage != null ? `≥ ${lastMileage.toLocaleString()}` : 'km...'}
              style={{
                width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px',
                border: `1px solid ${error ? '#DC2626' : 'var(--line)'}`, borderRadius: 7, fontSize: 13,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {lastMileage != null && (
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                ไมล์ปิดรอบก่อนหน้า: <span className="mono" style={{ fontWeight: 600, color: '#1D4ED8' }}>{lastMileage.toLocaleString()} km</span>
              </div>
            )}
            {error && (
              <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 4, fontWeight: 500 }}>
                ⚠ {error}
              </div>
            )}
          </div>

          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
            padding: '9px 14px', fontSize: 12, color: '#78350F',
          }}>
            รอบงานจะถูกสร้างในสถานะ <strong>รอออกเดินทาง</strong> และน้ำมันลอยจะถูกผูกกับรอบนี้ทันที
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#F8FAFC',
        }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button
            className="btn primary"
            onClick={handleConfirm}
            disabled={saving}
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'กำลังบันทึก...' : '✅ เปิดรอบ + ผูกน้ำมัน'}
          </button>
        </div>
      </div>
    </div>
  )
}
