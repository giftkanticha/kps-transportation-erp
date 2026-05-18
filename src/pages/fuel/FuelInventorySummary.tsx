import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import type { FuelRecord, FuelStock } from '../../types'
import { Icon, Field } from '../../components/ui'

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
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

  const allStocks = useMemo(() => db.getAll<FuelStock>('fuelStock'), [])
  const allFuelings = useMemo(() => db.getAll<FuelRecord>('fuel'), [])

  const days = daysInMonth(year, month)
  const monthStartISO = isoDate(year, month, 1)

  const dailyRows = useMemo<DailyStockRow[]>(() => {
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

  const monthTotals = useMemo(() => {
    const totalIn = dailyRows.reduce((s, r) => s + r.in, 0)
    const totalOut = dailyRows.reduce((s, r) => s + r.out, 0)
    const opening = dailyRows[0]?.brought ?? 0
    const closing = dailyRows[dailyRows.length - 1]?.balance ?? 0
    return { totalIn, totalOut, opening, closing }
  }, [dailyRows])

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุปคลังน้ำมันโรงงาน</h1>
          <div className="page-sub">รายงานยอดน้ำมันเข้า-ออกและคงเหลือรายวัน</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => window.print()}>
            <Icon name="download" size={15} /> พิมพ์รายงาน (PDF)
          </button>
        </div>
      </div>

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
              {Array.from({ length: 11 }, (_, i) => 2025 + i).map(y => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

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

      <div className="print-area">
        {/* Print header */}
        <div
          className="print-only"
          style={{ textAlign: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #000' }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>รายงานสรุปคลังน้ำมันโรงงาน</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{THAI_MONTHS_FULL[month - 1]} พ.ศ. {year + 543}</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="head">
            <h3>สรุปน้ำมันคลังโรงงานรายวัน</h3>
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

        {/* Signature block */}
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
            <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>ผู้จัดทำ</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>(.....................................)  </div>
            <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>ผู้อนุมัติ</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>(.....................................)  </div>
            <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
          </div>
        </div>
      </div>
    </div>
  )
}
