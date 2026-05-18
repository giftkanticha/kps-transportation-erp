import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import type { FuelRecord, FuelStock, Vehicle } from '../../types'
import { Icon, Field } from '../../components/ui'

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

interface DailyStockRow {
  day: number
  date: string
  brought: number
  in: number
  out: number
  balance: number
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

function isoDate(year: number, month1to12: number, day: number): string {
  const m = String(month1to12).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

export function FuelInventorySummary() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily')

  const vehicles = useMemo(() => db.getAll<Vehicle>('vehicles'), [])
  const allStocks = useMemo(() => db.getAll<FuelStock>('fuelStock'), [])
  const allFuelings = useMemo(() => db.getAll<FuelRecord>('fuel'), [])

  const days = daysInMonth(year, month)
  const monthStartISO = isoDate(year, month, 1)

  // ── Daily Stock Summary ──────────────────────────────────────────────────
  const dailyRows = useMemo<DailyStockRow[]>(() => {
    // Carry-over from all entries strictly before this month
    const carryIn = allStocks
      .filter(s => s.date < monthStartISO)
      .reduce((sum, s) => sum + (s.liters || 0), 0)
    const carryOut = allFuelings
      .filter(f => f.date < monthStartISO)
      .reduce((sum, f) => sum + (f.liters || 0), 0)
    let balance = carryIn - carryOut

    const rows: DailyStockRow[] = []
    for (let d = 1; d <= days; d++) {
      const iso = isoDate(year, month, d)
      const dayIn = allStocks
        .filter(s => s.date === iso)
        .reduce((sum, s) => sum + (s.liters || 0), 0)
      const dayOut = allFuelings
        .filter(f => f.date === iso)
        .reduce((sum, f) => sum + (f.liters || 0), 0)
      const brought = balance
      balance = brought + dayIn - dayOut
      rows.push({
        day: d,
        date: `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`,
        brought,
        in: dayIn,
        out: dayOut,
        balance,
      })
    }
    return rows
  }, [allStocks, allFuelings, year, month, days, monthStartISO])

  // ── Monthly Vehicle Fuel Report ──────────────────────────────────────────
  // { [day]: { [vehicleId]: liters } }
  const monthlyMatrix = useMemo<Record<number, Record<string, number>>>(() => {
    const data: Record<number, Record<string, number>> = {}
    for (let d = 1; d <= days; d++) data[d] = {}
    allFuelings.forEach(f => {
      const dt = new Date(f.date)
      if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return
      const d = dt.getDate()
      const vid = f.vehicleId
      if (!data[d]) data[d] = {}
      data[d][vid] = (data[d][vid] || 0) + (f.liters || 0)
    })
    return data
  }, [allFuelings, year, month, days])

  // Show only vehicles that have any fuel usage this month, plus all active ones
  const activeVehicles = useMemo(() => {
    const usedIds = new Set<string>()
    for (let d = 1; d <= days; d++) {
      Object.keys(monthlyMatrix[d] || {}).forEach(id => usedIds.add(id))
    }
    return vehicles.filter(v => usedIds.has(v.id) || v.status === 'available' || v.status === 'on-trip')
  }, [vehicles, monthlyMatrix, days])

  const dailyTotal = (d: number) =>
    activeVehicles.reduce((sum, v) => sum + (monthlyMatrix[d]?.[v.id] || 0), 0)

  const vehicleTotal = (vehicleId: string) => {
    let total = 0
    for (let d = 1; d <= days; d++) total += monthlyMatrix[d]?.[vehicleId] || 0
    return total
  }

  const grandTotal = activeVehicles.reduce((sum, v) => sum + vehicleTotal(v.id), 0)

  // ── KPI summary for header ───────────────────────────────────────────────
  const monthTotals = useMemo(() => {
    const totalIn = dailyRows.reduce((s, r) => s + r.in, 0)
    const totalOut = dailyRows.reduce((s, r) => s + r.out, 0)
    const opening = dailyRows[0]?.brought ?? 0
    const closing = dailyRows[dailyRows.length - 1]?.balance ?? 0
    return { totalIn, totalOut, opening, closing }
  }, [dailyRows])

  const handlePrint = () => window.print()

  return (
    <div>
      {/* Page head (hidden on print) */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุปคลังน้ำมันโรงงาน</h1>
          <div className="page-sub">
            สรุปยอดคงเหลือ + การใช้น้ำมันต่อคัน — รวม 2 มุมมองในหน้าเดียว
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={handlePrint}>
            <Icon name="download" size={15} /> พิมพ์รายงาน (PDF)
          </button>
        </div>
      </div>

      {/* Controls (hidden on print) */}
      <div className="card pad no-print" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="เดือน">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 160 }}>
              {THAI_MONTHS_FULL.map((m, i) => (
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
          <div className="spacer" />
          <div
            className="row"
            style={{
              gap: 6,
              padding: 4,
              background: 'var(--bg-sunk)',
              borderRadius: 8,
            }}
          >
            <button
              className={`btn ${activeTab === 'daily' ? 'primary' : 'ghost'}`}
              onClick={() => setActiveTab('daily')}
              style={{ minHeight: 36, padding: '7px 16px', fontSize: 13.5 }}
            >
              <Icon name="chart" size={14} /> สรุปรายวัน
            </button>
            <button
              className={`btn ${activeTab === 'monthly' ? 'primary' : 'ghost'}`}
              onClick={() => setActiveTab('monthly')}
              style={{ minHeight: 36, padding: '7px 16px', fontSize: 13.5 }}
            >
              <Icon name="truck" size={14} /> สรุปรายคัน
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards (hidden on print) */}
      <div className="grid-4 no-print" style={{ marginBottom: 18, gap: 14 }}>
        <div className="card kpi">
          <div className="label">ยอดเปิดเดือน</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
            {db.fmt(monthTotals.opening)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">น้ำมันเข้ารวม</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: '#166534' }}>
            +{db.fmt(monthTotals.totalIn)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">น้ำมันออกรวม</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: '#A32D2D' }}>
            −{db.fmt(monthTotals.totalOut)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">คงเหลือสิ้นเดือน</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: 'var(--primary)' }}>
            {db.fmt(monthTotals.closing)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span>
          </div>
        </div>
      </div>

      {/* Print area */}
      <div className="print-area">
        {/* Company header (visible only on print) */}
        <div
          className="print-only"
          style={{ textAlign: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #000' }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>
            รายงานสรุปการใช้น้ำมันประจำเดือน
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {THAI_MONTHS_FULL[month - 1]} พ.ศ. {year + 543}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}
          </div>
        </div>

        {/* Daily tab */}
        {activeTab === 'daily' && (
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="head">
              <h3>ตารางที่ 1 — สรุปน้ำมันคลังโรงงานรายวัน</h3>
            </div>
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>วันที่</th>
                    <th className="right">ยอดยกมา (ลิตร)</th>
                    <th className="right">น้ำมันเข้า (ลิตร)</th>
                    <th className="right">น้ำมันออก (ลิตร)</th>
                    <th className="right">คงเหลือ (ลิตร)</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map(r => (
                    <tr key={r.day}>
                      <td className="mono" style={{ fontWeight: 500 }}>{r.date}</td>
                      <td className="num right mono muted">{db.fmt(r.brought)}</td>
                      <td className="num right mono" style={{ color: r.in > 0 ? '#166534' : 'var(--text-muted)' }}>
                        {r.in > 0 ? `+${db.fmt(r.in)}` : '—'}
                      </td>
                      <td className="num right mono" style={{ color: r.out > 0 ? '#A32D2D' : 'var(--text-muted)' }}>
                        {r.out > 0 ? `−${db.fmt(r.out)}` : '—'}
                      </td>
                      <td className="num right mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {db.fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--primary-50)', fontWeight: 700 }}>
                    <td>รวมทั้งเดือน</td>
                    <td className="num right mono">—</td>
                    <td className="num right mono" style={{ color: '#166534' }}>+{db.fmt(monthTotals.totalIn)}</td>
                    <td className="num right mono" style={{ color: '#A32D2D' }}>−{db.fmt(monthTotals.totalOut)}</td>
                    <td className="num right mono" style={{ color: 'var(--primary)' }}>{db.fmt(monthTotals.closing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monthly tab */}
        {activeTab === 'monthly' && (
          <div className="card">
            <div className="head">
              <h3>ตารางที่ 2 — สรุปการใช้น้ำมันรายวันต่อคัน</h3>
              <div className="right muted" style={{ fontSize: 12 }}>
                {activeVehicles.length} คัน · {days} วัน
              </div>
            </div>
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
              {activeVehicles.length === 0 ? (
                <div className="empty" style={{ padding: 40 }}>
                  ไม่มีข้อมูลรถในระบบ
                </div>
              ) : (
                <table className="tbl" style={{ minWidth: 'max-content' }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          background: 'var(--bg-sunk)', minWidth: 90,
                        }}
                      >
                        วันที่
                      </th>
                      {activeVehicles.map(v => (
                        <th key={v.id} className="right mono" style={{ whiteSpace: 'nowrap' }}>
                          {v.plate}
                        </th>
                      ))}
                      <th
                        className="right"
                        style={{ background: '#FFF8E1', color: '#7A5A00', whiteSpace: 'nowrap' }}
                      >
                        รวมรายวัน
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: days }, (_, i) => i + 1).map(d => {
                      const total = dailyTotal(d)
                      return (
                        <tr key={d}>
                          <td
                            style={{
                              position: 'sticky', left: 0, zIndex: 1,
                              background: 'var(--card)', fontWeight: 500,
                            }}
                          >
                            {d} {THAI_MONTHS_SHORT[month - 1]}
                          </td>
                          {activeVehicles.map(v => {
                            const val = monthlyMatrix[d]?.[v.id] || 0
                            return (
                              <td
                                key={v.id}
                                className="num right mono"
                                style={{ color: val > 0 ? 'var(--text-1)' : 'var(--text-faint)' }}
                              >
                                {val > 0 ? db.fmt(val) : '—'}
                              </td>
                            )
                          })}
                          <td
                            className="num right mono"
                            style={{ background: '#FFF8E1', fontWeight: 700, color: '#7A5A00' }}
                          >
                            {total > 0 ? db.fmt(total) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: 'var(--primary-50)', fontWeight: 700 }}>
                      <td
                        style={{
                          position: 'sticky', left: 0, zIndex: 1,
                          background: 'var(--primary-50)', color: 'var(--primary)',
                        }}
                      >
                        รวมต่อคัน
                      </td>
                      {activeVehicles.map(v => (
                        <td key={v.id} className="num right mono" style={{ color: 'var(--primary)' }}>
                          {db.fmt(vehicleTotal(v.id))}
                        </td>
                      ))}
                      <td
                        className="num right mono"
                        style={{ background: '#FFE08A', color: '#5A3D00', fontWeight: 800 }}
                      >
                        {db.fmt(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* On print, render BOTH tables regardless of active tab */}
        <div className="print-only" style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 10px 0' }}>
            ตารางสรุปการใช้น้ำมันรายวันต่อคัน
          </h2>
          {activeVehicles.length > 0 && (
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>วันที่</th>
                  {activeVehicles.map(v => <th key={v.id} className="right">{v.plate}</th>)}
                  <th className="right" style={{ background: '#FFF8E1' }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: days }, (_, i) => i + 1).map(d => (
                  <tr key={d}>
                    <td>{d}</td>
                    {activeVehicles.map(v => (
                      <td key={v.id} className="num right">
                        {monthlyMatrix[d]?.[v.id] ? db.fmt(monthlyMatrix[d][v.id]) : '—'}
                      </td>
                    ))}
                    <td className="num right" style={{ background: '#FFF8E1', fontWeight: 700 }}>
                      {dailyTotal(d) > 0 ? db.fmt(dailyTotal(d)) : '—'}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#DBEAFE', fontWeight: 700 }}>
                  <td>รวมต่อคัน</td>
                  {activeVehicles.map(v => (
                    <td key={v.id} className="num right">{db.fmt(vehicleTotal(v.id))}</td>
                  ))}
                  <td className="num right" style={{ background: '#FFE08A' }}>{db.fmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Signature block (print only) */}
        <div
          className="print-only"
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
      </div>
    </div>
  )
}
