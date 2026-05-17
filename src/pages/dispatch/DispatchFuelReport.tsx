import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import type { Dispatch, Vehicle } from '../../types'
import { Icon, Field } from '../../components/ui'

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const KMPL_THRESHOLD = 3.5
const DEFAULT_LITER_PRICE = 32

interface FuelRow {
  jobId: string
  jobCode: string
  date: string
  vehicleId: string
  plate: string
  driverName: string
  cargo: string
  distance: number
  liters: number
  kmPerL: number
  costPerKm: number
  status: string
}

export function DispatchFuelReport() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [vehicleId, setVehicleId] = useState('')

  const vehicles = db.getAll<Vehicle>('vehicles')

  const rows = useMemo<FuelRow[]>(() => {
    const dispatches = db.getAll<Dispatch>('dispatch')
    return dispatches
      .filter(d => d.status === 'completed' && d.distance != null && d.liters != null)
      .filter(d => {
        const dt = new Date(d.date)
        if (dt.getMonth() + 1 !== month || dt.getFullYear() !== year) return false
        if (vehicleId && d.vehicleId !== vehicleId) return false
        return true
      })
      .map(d => {
        const distance = d.distance ?? 0
        const liters = d.liters ?? 0
        const kmPerL = liters > 0 ? Math.round((distance / liters) * 10) / 10 : 0
        const costPerKm = distance > 0 ? Math.round(((liters * DEFAULT_LITER_PRICE) / distance) * 100) / 100 : 0
        const v = vehicles.find(x => x.id === d.vehicleId)
        return {
          jobId: d.id,
          jobCode: d.code,
          date: d.date,
          vehicleId: d.vehicleId ?? '',
          plate: v?.plate ?? '—',
          driverName: db.nameOf('employees', d.driverId ?? ''),
          cargo: d.legs?.[0]?.cargo ?? '—',
          distance,
          liters,
          kmPerL,
          costPerKm,
          status: d.status,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [month, year, vehicleId, vehicles])

  const totals = useMemo(() => {
    const totalDistance = rows.reduce((s, r) => s + r.distance, 0)
    const totalLiters = rows.reduce((s, r) => s + r.liters, 0)
    const avgKmPerL = totalLiters > 0 ? Math.round((totalDistance / totalLiters) * 10) / 10 : 0
    const totalFuelCost = totalLiters * DEFAULT_LITER_PRICE
    return { totalDistance, totalLiters, avgKmPerL, totalFuelCost }
  }, [rows])

  const perVehicleAvg = useMemo(() => {
    const map = new Map<string, { plate: string; distance: number; liters: number }>()
    rows.forEach(r => {
      const cur = map.get(r.vehicleId) || { plate: r.plate, distance: 0, liters: 0 }
      cur.distance += r.distance
      cur.liters += r.liters
      map.set(r.vehicleId, cur)
    })
    return Array.from(map.values())
      .map(v => ({
        plate: v.plate,
        kmPerL: v.liters > 0 ? Math.round((v.distance / v.liters) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.kmPerL - a.kmPerL)
  }, [rows])

  const maxKmPerL = Math.max(KMPL_THRESHOLD * 1.5, ...perVehicleAvg.map(v => v.kmPerL))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานประจำวัน (อัตราสิ้นเปลืองน้ำมัน)</h1>
          <div className="page-sub">
            สรุปประสิทธิภาพ KM/L รายงาน — เกณฑ์: ≥ {KMPL_THRESHOLD} KM/L
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="เดือน">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 140 }}>
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
              <option value="">— ทั้งหมด —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate} • {v.brand}</option>
              ))}
            </select>
          </Field>
          <div className="spacer" />
          <div className="muted" style={{ fontSize: 12.5 }}>
            พบ <strong style={{ color: 'var(--text-1)' }}>{rows.length}</strong> รายการ
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid-4" style={{ marginBottom: 18, gap: 14 }}>
        <div className="card kpi">
          <div className="label">ระยะทางรวม</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
            {db.fmt(totals.totalDistance)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>กม.</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ลิตรที่ใช้รวม</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
            {db.fmt(totals.totalLiters)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">เฉลี่ย KM/L</div>
          <div
            className="mono"
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 8,
              color: totals.avgKmPerL >= KMPL_THRESHOLD ? '#166534' : '#A32D2D',
            }}
          >
            {totals.avgKmPerL.toFixed(1)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>km/L</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ต้นทุนน้ำมัน (โดยประมาณ)</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
            {db.thb(totals.totalFuelCost)}
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
            ใช้ราคา ฿{DEFAULT_LITER_PRICE}/ลิตร
          </div>
        </div>
      </div>

      {/* Bar chart per vehicle */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head">
          <h3>เปรียบเทียบ KM/L ตามรถ</h3>
          <div className="right">
            <span className="badge red" style={{ fontSize: 11 }}>
              ต่ำกว่าเกณฑ์ ({KMPL_THRESHOLD})
            </span>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          {perVehicleAvg.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>ไม่มีข้อมูลในเดือนที่เลือก</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {perVehicleAvg.map(v => {
                const pct = (v.kmPerL / maxKmPerL) * 100
                const isLow = v.kmPerL < KMPL_THRESHOLD
                const color = isLow ? '#A32D2D' : '#0066CC'
                return (
                  <div key={v.plate} className="row" style={{ alignItems: 'center', gap: 12 }}>
                    <span className="mono" style={{ minWidth: 110, fontWeight: 600, fontSize: 13 }}>
                      {v.plate}
                    </span>
                    <div style={{ flex: 1, background: 'var(--bg-sunk)', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: color,
                          transition: 'width .25s',
                        }}
                      />
                    </div>
                    <span
                      className="mono"
                      style={{ minWidth: 90, textAlign: 'right', fontWeight: 700, color }}
                    >
                      {v.kmPerL.toFixed(1)} km/L
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Data table */}
      <div className="card">
        <div className="head">
          <h3>รายการเดินทาง</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>รหัสงาน</th>
                <th>ทะเบียนรถ</th>
                <th>สินค้า</th>
                <th className="right">ระยะทาง (กม.)</th>
                <th className="right">ลิตร</th>
                <th className="right">KM/L</th>
                <th className="right">บาท/กม.</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const low = r.kmPerL > 0 && r.kmPerL < KMPL_THRESHOLD
                return (
                  <tr key={r.jobId}>
                    <td className="muted">{db.thaiDate(r.date)}</td>
                    <td><span className="mono" style={{ fontWeight: 600 }}>{r.jobCode}</span></td>
                    <td><span className="mono" style={{ color: 'var(--primary)' }}>{r.plate}</span></td>
                    <td>{r.cargo}</td>
                    <td className="num right mono">{db.fmt(r.distance)}</td>
                    <td className="num right mono">{db.fmt(r.liters)}</td>
                    <td
                      className="num right mono"
                      style={{ color: low ? '#A32D2D' : '#166534', fontWeight: 700 }}
                    >
                      {r.kmPerL.toFixed(1)}
                      {low && <Icon name="alert" size={11} style={{ marginLeft: 4 }} />}
                    </td>
                    <td className="num right mono">฿{r.costPerKm.toFixed(2)}</td>
                    <td>
                      <span className="badge green" style={{ fontSize: 11 }}>เสร็จสิ้น</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty" style={{ padding: 40 }}>
              ไม่มีข้อมูลรายงานในเดือนที่เลือก — ปิดงานในระบบเพื่อสร้างประวัติการเดินทาง
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
