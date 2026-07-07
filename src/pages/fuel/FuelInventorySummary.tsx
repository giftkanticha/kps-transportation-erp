import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import type { FuelRecord, FuelStock } from '../../types'
import { Field, PrintButton, FontScaleControl } from '../../components/ui'

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}
function isoDate(year: number, month1to12: number, day: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
// Factory-tank fills are tagged with the literal Thai string by both
// ExpressFuelLog (source=FACTORY_TANK → 'ถังโรงงาน') and DispatchRoundClose.
// The previous exclusion-list ('PTT' / 'Shell' / …) accidentally classified
// the new Thai supplier names ('บริษัท ปตท.' etc.) as factory, leaking
// external pumps into the factory daily ledger.
const isFactoryStation = (station: string) => station === 'ถังโรงงาน'

export function FuelInventorySummary() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  const { data: allStocks = [] } = useList<FuelStock>('fuel_stock')
  const { data: allFuelings = [] } = useList<FuelRecord>('fuel_records')
  const factoryFuelings = useMemo(
    () => allFuelings.filter(f => isFactoryStation(f.station)),
    [allFuelings],
  )

  const days = daysInMonth(year, month)
  const monthStartISO = isoDate(year, month, 1)

  const dailyRows = useMemo(() => {
    // Normalise to the date part — some legacy fuel_records carry a 'YYYY-MM-DD
    // HH:mm' value. Comparing with '===' against a bare 'YYYY-MM-DD' silently
    // dropped those rows from their own day (they'd reappear as next month's
    // carry-in), making the printed report look like stock had gone missing.
    const dayOf = (s: string) => (s ?? '').slice(0, 10)
    const carryIn = allStocks.filter(s => dayOf(s.date) < monthStartISO).reduce((sum, s) => sum + s.liters, 0)
    const carryOut = factoryFuelings.filter(f => dayOf(f.date) < monthStartISO).reduce((sum, f) => sum + f.liters, 0)
    let balance = carryIn - carryOut
    const rows = []
    for (let d = 1; d <= days; d++) {
      const iso = isoDate(year, month, d)
      const dayIn = allStocks.filter(s => dayOf(s.date) === iso).reduce((sum, s) => sum + s.liters, 0)
      const dayOut = factoryFuelings.filter(f => dayOf(f.date) === iso).reduce((sum, f) => sum + f.liters, 0)
      const brought = balance
      balance = brought + dayIn - dayOut
      rows.push({ day: d, date: `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`, brought, in: dayIn, out: dayOut, balance })
    }
    return rows
  }, [allStocks, factoryFuelings, year, month, days, monthStartISO])

  const monthTotals = useMemo(() => ({
    totalIn: dailyRows.reduce((s, r) => s + r.in, 0),
    totalOut: dailyRows.reduce((s, r) => s + r.out, 0),
    opening: dailyRows[0]?.brought ?? 0,
    closing: dailyRows[dailyRows.length - 1]?.balance ?? 0,
  }), [dailyRows])

  return (
    <div className="print-area">
      {/* Controls (no-print) */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุปคลังน้ำมันรวม</h1>
          <div className="page-sub">รายงานรายวันต่อเดือน • พิมพ์ได้</div>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FontScaleControl />
          <PrintButton orientation="portrait" label="พิมพ์รายงาน" />
        </div>
      </div>

      <div className="card pad no-print" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="เดือน">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 160 }}>
              {THAI_MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field label="ปี (พ.ศ.)">
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 120 }}>
              {Array.from({ length: 11 }, (_, i) => 2025 + i).map(y => <option key={y} value={y}>{y + 543}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* KPI cards */}
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

      {/* Print header */}
      <div className="kps-print-header print-only">
        <p className="co">KPS Transportations</p>
        <p className="ttl">รายงานสรุปคลังน้ำมันโรงงาน</p>
        <p className="sub">{THAI_MONTHS_FULL[month - 1]} พ.ศ. {year + 543}</p>
        <p className="ts">พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</p>
      </div>

      {/* Daily table */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head">
          <h3>สรุปน้ำมันคลังโรงงานรายวัน — {THAI_MONTHS_FULL[month - 1]} {year + 543}</h3>
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

      {/* Signature block (print only) */}
      <div className="kps-print-sig print-only">
        <div className="kps-print-sig-slot">
          <div className="line">ผู้จัดทำ</div>
          <div className="name">(.....................................)</div>
          <div className="date">วันที่ ......./......./.......</div>
        </div>
        <div className="kps-print-sig-slot">
          <div className="line">ผู้อนุมัติ</div>
          <div className="name">(.....................................)</div>
          <div className="date">วันที่ ......./......./.......</div>
        </div>
      </div>
    </div>
  )
}
