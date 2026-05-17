import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import type { Dispatch, Vehicle } from '../../types'
import { Icon, Field } from '../../components/ui'

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const KMPL_THRESHOLD = 3.5
const DEFAULT_LITER_PRICE = 32

interface JobRow {
  date: string
  cargo: string
  distance: number
  liters: number
  kmPerL: number
  costPerKm: number
}

interface VehicleGroup {
  vehicleId: string
  plate: string
  brand: string
  driverName: string
  rows: JobRow[]
  totalDistance: number
  totalLiters: number
  avgKmPerL: number
  totalFuelCost: number
}

export function DispatchMonthlyReport() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [vehicleId, setVehicleId] = useState('')

  const vehicles = db.getAll<Vehicle>('vehicles')

  const groups = useMemo<VehicleGroup[]>(() => {
    const dispatches = db.getAll<Dispatch>('dispatch')
    const map = new Map<string, VehicleGroup>()
    dispatches
      .filter(d => d.status === 'completed' && d.distance != null && d.liters != null)
      .filter(d => {
        const dt = new Date(d.date)
        if (dt.getMonth() + 1 !== month || dt.getFullYear() !== year) return false
        if (vehicleId && d.vehicleId !== vehicleId) return false
        return true
      })
      .forEach(d => {
        const vid = d.vehicleId ?? ''
        if (!map.has(vid)) {
          const v = vehicles.find(x => x.id === vid)
          map.set(vid, {
            vehicleId: vid,
            plate: v?.plate ?? '—',
            brand: v?.brand ?? '',
            driverName: db.nameOf('employees', d.driverId ?? ''),
            rows: [],
            totalDistance: 0,
            totalLiters: 0,
            avgKmPerL: 0,
            totalFuelCost: 0,
          })
        }
        const g = map.get(vid)!
        const distance = d.distance ?? 0
        const liters = d.liters ?? 0
        const kmPerL = liters > 0 ? Math.round((distance / liters) * 10) / 10 : 0
        const costPerKm = distance > 0 ? Math.round(((liters * DEFAULT_LITER_PRICE) / distance) * 100) / 100 : 0
        g.rows.push({
          date: d.date,
          cargo: d.legs?.[0]?.cargo ?? '—',
          distance,
          liters,
          kmPerL,
          costPerKm,
        })
        g.totalDistance += distance
        g.totalLiters += liters
      })

    return Array.from(map.values()).map(g => {
      g.rows.sort((a, b) => a.date.localeCompare(b.date))
      g.avgKmPerL = g.totalLiters > 0 ? Math.round((g.totalDistance / g.totalLiters) * 10) / 10 : 0
      g.totalFuelCost = g.totalLiters * DEFAULT_LITER_PRICE
      return g
    }).sort((a, b) => a.plate.localeCompare(b.plate))
  }, [month, year, vehicleId, vehicles])

  const grandTotal = useMemo(() => {
    const d = groups.reduce((s, g) => s + g.totalDistance, 0)
    const l = groups.reduce((s, g) => s + g.totalLiters, 0)
    return {
      distance: d,
      liters: l,
      avgKmPerL: l > 0 ? Math.round((d / l) * 10) / 10 : 0,
      fuelCost: l * DEFAULT_LITER_PRICE,
    }
  }, [groups])

  const handlePrint = () => window.print()

  return (
    <div>
      {/* Page head (hidden on print) */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">รายงานประจำเดือน</h1>
          <div className="page-sub">
            สรุปผลการเดินรถและอัตราสิ้นเปลืองน้ำมัน — แยกตามทะเบียนรถ
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={handlePrint}>
            <Icon name="download" size={15} /> พิมพ์รายงานรายเดือน (PDF)
          </button>
        </div>
      </div>

      {/* Filters (hidden on print) */}
      <div className="card pad no-print" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="เดือน">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 160 }}>
              {THAI_MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="ปี (พ.ศ.)">
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 120 }}>
              {[year - 1, year, year + 1].map(y => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </Field>
          <Field label="ทะเบียนรถ">
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={{ width: 220 }}>
              <option value="">— ทุกคัน —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate} • {v.brand}</option>
              ))}
            </select>
          </Field>
          <div className="spacer" />
          <div className="muted" style={{ fontSize: 12.5 }}>
            {groups.length} คัน · {groups.reduce((s, g) => s + g.rows.length, 0)} เที่ยว
          </div>
        </div>
      </div>

      {/* Print area */}
      <div className="print-area">
        {/* Company header */}
        <div style={{ textAlign: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #000' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>
            รายงานสรุปผลการเดินรถและอัตราสิ้นเปลืองน้ำมัน
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            ประจำเดือน {THAI_MONTHS[month - 1]} พ.ศ. {year + 543}
            {vehicleId && ` · เฉพาะ ${vehicles.find(v => v.id === vehicleId)?.plate}`}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}
          </div>
        </div>

        {groups.length === 0 && (
          <div className="empty" style={{ padding: 40, textAlign: 'center' }}>
            ไม่มีข้อมูลในเดือนที่เลือก
          </div>
        )}

        {/* Vehicle groups */}
        {groups.map((g, gi) => (
          <div
            key={g.vehicleId}
            className="vehicle-group"
            style={{ marginBottom: 24, pageBreakInside: 'avoid', breakInside: 'avoid' }}
          >
            <div
              className="row"
              style={{
                marginBottom: 8,
                padding: '6px 10px',
                background: 'var(--bg-sunk)',
                borderRadius: 4,
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                {gi + 1}.
              </span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                {g.plate}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {g.brand}
              </span>
              <div className="spacer" />
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                คนขับ: <strong>{g.driverName}</strong>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                เที่ยว: <strong>{g.rows.length}</strong>
              </span>
            </div>

            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>ลำดับ</th>
                  <th>วันที่</th>
                  <th>สินค้า</th>
                  <th className="right">ระยะทาง (กม.)</th>
                  <th className="right">ลิตร</th>
                  <th className="right">KM/L</th>
                  <th className="right">บาท/กม.</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => {
                  const low = r.kmPerL > 0 && r.kmPerL < KMPL_THRESHOLD
                  return (
                    <tr key={i}>
                      <td className="muted">{i + 1}</td>
                      <td>{db.thaiDate(r.date)}</td>
                      <td>{r.cargo}</td>
                      <td className="num right mono">{db.fmt(r.distance)}</td>
                      <td className="num right mono">{db.fmt(r.liters)}</td>
                      <td
                        className="num right mono"
                        style={{ color: low ? '#A32D2D' : '#166534', fontWeight: 600 }}
                      >
                        {r.kmPerL.toFixed(1)}
                      </td>
                      <td className="num right mono">฿{r.costPerKm.toFixed(2)}</td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--green-50)', fontWeight: 700 }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>รวม:</td>
                  <td className="num right mono">{db.fmt(g.totalDistance)}</td>
                  <td className="num right mono">{db.fmt(g.totalLiters)}</td>
                  <td
                    className="num right mono"
                    style={{ color: g.avgKmPerL < KMPL_THRESHOLD ? '#A32D2D' : '#166534' }}
                  >
                    {g.avgKmPerL.toFixed(1)}
                  </td>
                  <td className="num right mono">{db.thb(g.totalFuelCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {/* Grand total */}
        {groups.length > 0 && (
          <div
            style={{
              marginTop: 20,
              padding: '12px 16px',
              border: '2px solid #000',
              borderRadius: 4,
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>สรุปรวมทั้งเดือน</h3>
            <div className="grid-4" style={{ gap: 12, fontSize: 12 }}>
              <div>
                <div style={{ color: '#666' }}>รวมระยะทาง</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{db.fmt(grandTotal.distance)} กม.</div>
              </div>
              <div>
                <div style={{ color: '#666' }}>รวมลิตร</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{db.fmt(grandTotal.liters)} ลิตร</div>
              </div>
              <div>
                <div style={{ color: '#666' }}>เฉลี่ย KM/L</div>
                <div
                  className="mono"
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: grandTotal.avgKmPerL < KMPL_THRESHOLD ? '#A32D2D' : '#166534',
                  }}
                >
                  {grandTotal.avgKmPerL.toFixed(1)}
                </div>
              </div>
              <div>
                <div style={{ color: '#666' }}>ต้นทุนน้ำมันรวม</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{db.thb(grandTotal.fuelCost)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Signature section */}
        {groups.length > 0 && (
          <div
            style={{
              marginTop: 40,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 60,
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>
                ผู้จัดทำ
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                (.....................................)
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>
                ผู้อนุมัติ
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                (.....................................)
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
