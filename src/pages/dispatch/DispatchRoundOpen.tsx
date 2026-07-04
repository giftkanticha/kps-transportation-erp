import { useState, useMemo, useEffect, useRef } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import type { Vehicle, Employee, Dispatch, User } from '../../types'
import { Icon, StatusBadge, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
  user: User
}

interface ToastState { kind: 'success' | 'error'; msg: string }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2800)
    return () => clearTimeout(t)
  }, [toast, onClose])
  const ok = toast.kind === 'success'
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
        background: ok ? '#10B981' : '#EF4444', color: '#fff',
        padding: '12px 18px', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 14, fontWeight: 500,
        minWidth: 260, maxWidth: 'calc(100vw - 32px)',
      }}
    >{toast.msg}</div>
  )
}

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function DispatchRoundOpen({ setActive, setSubject, user }: Props) {
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatches = [] } = useDispatches()
  const insertDispatch = useInsert<Dispatch>('dispatch')
  const drafts = useMemo(
    () => dispatches.filter(d => d.roundStatus === 'draft'),
    [dispatches],
  )

  const drivers = employees.filter(e => e.position === 'คนขับ')

  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState(user.role === 'driver' ? user.id : '')
  const [startMileage, setStartMileage] = useState('')
  const [departAt, setDepartAt] = useState(nowLocal())
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)

  const vehicle = vehicles.find(v => v.id === vehicleId)
  const lastMileage = vehicleId ? db.lastClosedMileage(vehicleId, dispatches) : null
  const lastClosedRound = useMemo(() => {
    if (!vehicleId) return null
    const closed = dispatches
      .filter(d => d.vehicleId === vehicleId && d.roundStatus === 'closed')
      .sort((a, b) => (b.returnAt || b.depart || '').localeCompare(a.returnAt || a.depart || ''))
    return closed[0] ?? null
  }, [vehicleId, dispatches])

  // Auto-fill start mileage from the most recent closed round (or vehicle.odometer
  // fallback). Re-runs when dispatch data loads in late, but never clobbers a
  // value the user has manually edited.
  const autoFillRef = useRef<{ vehicleId: string; value: string } | null>(null)
  useEffect(() => {
    if (!vehicleId) {
      setStartMileage('')
      autoFillRef.current = null
      return
    }
    const next = lastMileage != null
      ? String(lastMileage)
      : vehicle ? String(vehicle.odometer || '') : ''
    const prev = autoFillRef.current
    const userTouched = prev != null && prev.vehicleId === vehicleId && prev.value !== startMileage
    if (!userTouched) {
      setStartMileage(next)
      autoFillRef.current = { vehicleId, value: next }
    }
  }, [vehicleId, lastMileage, vehicle?.odometer])

  // Auto-sync driver from vehicle.driverId whenever vehicle changes (overwrites).
  // Vehicle has a "คนขับประจำ" relationship that's the source of truth.
  useEffect(() => {
    if (!vehicleId) return
    if (vehicle?.driverId) setDriverId(vehicle.driverId)
  }, [vehicleId])

  const validate = (): string | null => {
    if (!vehicleId) return 'กรุณาเลือกรถ'
    if (!driverId) return 'กรุณาเลือกคนขับ'
    if (!startMileage) return 'กรุณากรอกเลขไมล์ต้นรอบ'
    const sm = Number(startMileage)
    if (isNaN(sm) || sm < 0) return 'เลขไมล์ไม่ถูกต้อง'
    if (!departAt) return 'กรุณาระบุวันที่/เวลาออกเดินทาง'
    return null
  }

  const createRound = async (gotoDetail: boolean) => {
    const err = validate()
    if (err) { setToast({ kind: 'error', msg: err }); return }
    try {
      const round = await insertDispatch.mutateAsync({
        code: db.nextRoundCode(dispatches),
        customerId: null,
        driverId,
        vehicleId,
        subcontractorId: null,
        date: departAt.slice(0, 10),
        depart: departAt,
        eta: '',
        status: 'scheduled',
        progress: 0,
        startOdometer: Number(startMileage),
        endOdometer: null,
        distance: null,
        liters: null,
        kmPerL: null,
        perDiem: null,
        notes,
        totalAmount: 0,
        revenue: 0,
        cost: 0,
        roundStatus: 'draft',
        otherExpenses: [],
      })
      setToast({ kind: 'success', msg: `✅ เปิดรอบ ${round.code} เรียบร้อย` })
      if (gotoDetail) {
        setSubject({ type: 'round', id: round.id })
        setActive('dispatch.round')
      } else {
        setVehicleId(''); setDriverId(user.role === 'driver' ? user.id : '')
        setStartMileage(''); setNotes(''); setDepartAt(nowLocal())
      }
    } catch (e) {
      setToast({ kind: 'error', msg: '❌ บันทึกไม่สำเร็จ: ' + (e as Error).message })
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">เปิดงานขนส่ง</h1>
          <div className="page-sub">เปิดรอบงานใหม่ และเพิ่มขาตามลำดับ</div>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="head">
            <h3>รอบงานค้าง ({drafts.length})</h3>
          </div>
          <div className="tbl-wrap stack-wrap" style={{ border: 'none' }}>
            <table className="tbl stack">
              <thead>
                <tr>
                  <th>รหัสรอบ</th>
                  <th>ทะเบียน</th>
                  <th>คนขับ</th>
                  <th>ออกเดินทาง</th>
                  <th className="num">ไมล์ต้น</th>
                  <th className="num">จำนวนขา</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drafts.map(d => {
                  const v = vehicles.find(x => x.id === d.vehicleId)
                  const dr = employees.find(x => x.id === d.driverId)
                  return (
                    <tr
                      key={d.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSubject({ type: 'round', id: d.id })
                        setActive('dispatch.round')
                      }}
                    >
                      <td className="mono" data-label="รหัสรอบ" style={{ color: 'var(--primary)', fontWeight: 600 }}>{d.code}</td>
                      <td className="mono" data-label="ทะเบียน">{v?.plate ?? '—'}</td>
                      <td data-label="คนขับ">{dr?.name ?? '—'}</td>
                      <td className="num muted" data-label="ออกเดินทาง">{db.thaiDate(d.depart || d.date)}</td>
                      <td className="num" data-label="ไมล์ต้น">{db.fmt(d.startOdometer)}</td>
                      <td className="num" data-label="จำนวนขา">{d.legs?.length ?? 0}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          className="btn sm"
                          onClick={() => {
                            setSubject({ type: 'round', id: d.id })
                            setActive('dispatch.round')
                          }}
                        >
                          <Icon name="edit" size={13} /> จัดการขา
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="layout-main-aside">
        {/* Form */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}><Icon name="package" size={20} /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>เริ่มรอบใหม่</h3>
          </div>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลือกรถ *">
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                <option value="">-- เลือก --</option>
                {/* Only TRANSPORT-grouped vehicles can be dispatched on a haul.
                    INTERNAL ones (forklifts, loaders, ภายในลาน, company cars)
                    aren't relevant here and were making the dropdown overflow. */}
                {vehicles
                  .filter(v => v.groupKind === 'TRANSPORT')
                  .sort((a, b) => a.plate.localeCompare(b.plate))
                  .map(v => (
                    <option key={v.id} value={v.id}>{v.plate} ({v.brand} · {v.type})</option>
                  ))}
              </select>
            </Field>
            <Field label="เลือกคนขับ *">
              <select
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
                disabled={!vehicleId}
                style={{
                  background: vehicle?.driverId && driverId === vehicle.driverId ? '#EFF6FF' : undefined,
                  borderColor: vehicle?.driverId && driverId === vehicle.driverId ? '#BFDBFE' : undefined,
                }}
              >
                <option value="">{vehicleId ? '-- เลือกคนขับ --' : 'เลือกรถก่อน'}</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code}){d.id === vehicle?.driverId ? ' ⭐ ประจำรถ' : ''}
                  </option>
                ))}
              </select>
              {vehicleId && vehicle?.driverId && driverId === vehicle.driverId && (
                <div style={{ fontSize: 11, color: '#1D4ED8', marginTop: 4 }}>
                  ✓ ซิงค์อัตโนมัติจากทะเบียน {vehicle.plate}
                </div>
              )}
              {vehicleId && driverId && vehicle?.driverId && driverId !== vehicle.driverId && (
                <div style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>
                  ⚠ ไม่ใช่คนขับประจำรถ (ประจำรถ: {employees.find(e => e.id === vehicle.driverId)?.name ?? '—'})
                </div>
              )}
              {vehicleId && !vehicle?.driverId && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  รถคันนี้ยังไม่ได้กำหนดคนขับประจำ
                </div>
              )}
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลขไมล์ต้นรอบ (km) *">
              <input
                type="number"
                value={startMileage}
                onChange={e => setStartMileage(e.target.value)}
                placeholder="กรอกไมล์เริ่มต้น"
              />
              {lastMileage != null && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Auto-fill จากรอบล่าสุด: {db.fmt(lastMileage)} km (แก้ไขได้)
                </div>
              )}
            </Field>
            <Field label="วันที่/เวลาออกเดินทาง *">
              <input type="datetime-local" value={departAt} onChange={e => setDepartAt(e.target.value)} />
            </Field>
          </div>
          <Field label="หมายเหตุ">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
              style={{ resize: 'vertical', minHeight: 56 }}
            />
          </Field>

          <div className="row btn-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => createRound(false)}>
              <Icon name="check" size={15} /> บันทึกร่าง
            </button>
            <button className="btn primary" onClick={() => createRound(true)}>
              <Icon name="plus" size={15} /> เปิดงาน + เพิ่มขาแรก
            </button>
          </div>
        </div>

        {/* Vehicle info card */}
        <div className="card">
          <div className="head">
            <h3>สถานะรถ</h3>
          </div>
          {vehicle ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>ทะเบียน</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                  {vehicle.plate}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {vehicle.brand} · {vehicle.type}
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>สถานะ</div>
                <div style={{ marginTop: 4 }}><StatusBadge status={vehicle.status} /></div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>เลขไมล์ล่าสุด</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                  {lastMileage != null ? db.fmt(lastMileage) : db.fmt(vehicle.odometer)} km
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>รอบล่าสุด</div>
                <div style={{ fontSize: 13 }}>
                  {lastClosedRound
                    ? <span className="mono" style={{ color: 'var(--primary)' }}>{lastClosedRound.code}</span>
                    : <span className="muted">— ยังไม่มี —</span>}
                  {lastClosedRound && <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>✓ CLOSED</span>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              เลือกรถเพื่อดูข้อมูล
            </div>
          )}
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
