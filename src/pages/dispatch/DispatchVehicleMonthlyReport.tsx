import { useState, useMemo } from 'react'
import { db, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { usePrint } from '../../hooks/usePrint'
import type { Vehicle, Employee, Dispatch, FuelRound } from '../../types'
import { Icon, Field } from '../../components/ui'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

type StatusFilter = 'closed' | 'all'

interface LegRow {
  key: string
  depart: string
  returnAt: string
  crossMonth: boolean
  code: string
  status: 'draft' | 'closed' | 'legacy'
  cargo: string
  weight: number | null
  deliveredWeight: number | null
  price: number | null
  amount: number
  perDiem: number | null
  liters: number | null
  endOdometer: number | null
  kmPerL: number | null
}

function monthBounds(year: number, month1: number): { start: string; endExclusive: string } {
  const startD = new Date(Date.UTC(year, month1 - 1, 1))
  const endD = new Date(Date.UTC(year, month1, 1))
  return { start: startD.toISOString().slice(0, 10), endExclusive: endD.toISOString().slice(0, 10) }
}

export function DispatchVehicleMonthlyReport() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [vehicleId, setVehicleId] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('closed')

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatch = [] } = useDispatches()
  const { data: fuelRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { print } = usePrint()

  const { start, endExclusive } = monthBounds(year, month)
  const selVehicle = vehicles.find(v => v.id === vehicleId)
  const defaultDriver = employees.find(e => e.id === selVehicle?.driverId)

  // รอบที่เปิดงาน (depart) อยู่ในเดือน/ปีที่เลือก + เป็นรถคันนั้น
  const rounds = useMemo<Dispatch[]>(() => {
    if (!vehicleId) return []
    return dispatch
      .filter(d => d.vehicleId === vehicleId)
      .filter(d => {
        const basis = (d.depart || d.date || '').slice(0, 10)
        if (!basis) return false
        return basis >= start && basis < endExclusive
      })
      .filter(d => {
        if (statusFilter === 'closed') return d.roundStatus === 'closed' || d.status === 'completed'
        return d.roundStatus === 'draft' || d.roundStatus === 'closed' || d.status === 'completed'
      })
      .sort((a, b) => (a.depart || a.date || '').localeCompare(b.depart || b.date || ''))
  }, [dispatch, vehicleId, start, endExclusive, statusFilter])

  // เรียงเที่ยว: ทุก leg ของทุกรอบ — ถ้ารอบไม่มี leg ก็ใส่เป็น 1 แถว
  const legRows = useMemo<LegRow[]>(() => {
    const out: LegRow[] = []
    rounds.forEach(r => {
      const depart10 = (r.depart || r.date || '').slice(0, 10)
      const returnAt10 = (r.returnAt || '').slice(0, 10)
      const crossMonth = returnAt10 !== '' && (returnAt10 < start || returnAt10 >= endExclusive)
      const fuelRound = db.fuelRoundOfDispatch(r.id, fuelRounds)
      const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (r.liters || 0)
      const distance = db.roundDistance(r)
      const kmPerL = consumed > 0 && distance > 0 ? distance / consumed : null
      const status: LegRow['status'] =
        r.roundStatus === 'draft' ? 'draft'
          : r.roundStatus === 'closed' ? 'closed'
            : 'legacy'
      const legs = r.legs ?? []
      if (legs.length === 0) {
        out.push({
          key: r.id,
          depart: depart10,
          returnAt: returnAt10,
          crossMonth,
          code: r.code,
          status,
          cargo: '—',
          weight: null,
          deliveredWeight: null,
          price: null,
          amount: db.roundRevenue(r),
          perDiem: db.roundPerDiem(r) || null,
          liters: consumed || null,
          endOdometer: r.endOdometer,
          kmPerL,
        })
        return
      }
      legs.forEach((l, i) => {
        out.push({
          key: `${r.id}-${i}`,
          depart: depart10,
          returnAt: i === 0 ? returnAt10 : '',
          crossMonth: i === 0 ? crossMonth : false,
          code: i === 0 ? r.code : '',
          status: i === 0 ? status : status,
          cargo: l.cargo || [l.origin, l.destination].filter(Boolean).join(' - ') || '—',
          weight: l.weight ?? null,
          deliveredWeight: l.deliveredWeight ?? null,
          price: l.price ?? null,
          amount: l.amount || 0,
          perDiem: l.perDiem ?? null,
          liters: i === 0 ? (consumed || null) : null,
          endOdometer: i === 0 ? r.endOdometer : null,
          kmPerL: i === 0 ? kmPerL : null,
        })
      })
    })
    return out
  }, [rounds, fuelRounds, start, endExclusive])

  // Totals (per รอบ — ไม่นับซ้ำต่อ leg)
  const totals = useMemo(() => {
    let revenue = 0, fuelCost = 0, perDiem = 0, other = 0, distance = 0, liters = 0
    rounds.forEach(r => {
      const fuelRound = db.fuelRoundOfDispatch(r.id, fuelRounds)
      const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (r.liters || 0)
      revenue += db.roundRevenue(r)
      perDiem += db.roundPerDiem(r)
      other += db.roundOtherExpenses(r)
      fuelCost += fuelRound ? db.fuelRoundCost(fuelRound) : (r.cost || 0)
      distance += db.roundDistance(r)
      liters += consumed
    })
    const profit = revenue - fuelCost - perDiem - other
    const avgKmPerL = liters > 0 && distance > 0 ? distance / liters : null
    return { revenue, fuelCost, perDiem, other, profit, distance, liters, avgKmPerL }
  }, [rounds, fuelRounds])

  const crossMonthCount = legRows.filter(r => r.crossMonth).length
  const abnormalCount = rounds.filter(r => {
    const fuelRound = db.fuelRoundOfDispatch(r.id, fuelRounds)
    const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (r.liters || 0)
    const dist = db.roundDistance(r)
    const kmPerL = consumed > 0 && dist > 0 ? dist / consumed : null
    return kmPerL != null && kmPerL < DSP_KMPL_THRESHOLD
  }).length

  const numFmt = (v: number | null | undefined) => (v != null && v !== 0 ? db.fmt(v) : '–')
  const priceFmt = (v: number | null | undefined) =>
    v != null && v !== 0 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '–'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">สรุปรายเที่ยวรายเดือน (ต่อคัน)</h1>
          <div className="page-sub">
            เลือกทะเบียน + เดือน — นับเฉพาะรอบที่ <strong>วันเปิดงาน</strong> อยู่ในเดือนนั้น (เที่ยวคร่อมเดือนยังคงอยู่ในเดือนที่เปิด)
          </div>
        </div>
        <div className="actions no-print">
          <button className="btn primary" onClick={() => print('landscape')} disabled={!vehicleId}>
            <Icon name="download" size={15} /> พิมพ์ / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad no-print" style={{ marginBottom: 16 }}>
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
              {[year - 2, year - 1, year, year + 1].map(y => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </Field>
          <Field label="ทะเบียนรถ *">
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={{ width: 240 }}>
              <option value="">— เลือกทะเบียน —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate}{v.brand ? ` • ${v.brand}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="สถานะรอบ">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={{ width: 180 }}>
              <option value="closed">เฉพาะที่ปิดแล้ว</option>
              <option value="all">รวม DRAFT</option>
            </select>
          </Field>
          <div className="spacer" />
          <div className="muted" style={{ fontSize: 12.5 }}>
            {rounds.length} รอบ · {legRows.length} เที่ยว
          </div>
        </div>
      </div>

      {!vehicleId && (
        <div className="card pad no-print" style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>
          กรุณาเลือก <strong>ทะเบียนรถ</strong> เพื่อสร้างรายงาน
        </div>
      )}

      {vehicleId && (
        <div className="print-area">
          {/* Print header */}
          <div style={{ textAlign: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #000' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>
              สรุปรายเที่ยวประจำเดือน
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              ทะเบียน <strong>{selVehicle?.plate}</strong>
              {selVehicle?.brand ? ` (${selVehicle.brand})` : ''}
              {' · '}ประจำเดือน {THAI_MONTHS[month - 1]} พ.ศ. {year + 543}
              {defaultDriver ? ` · คนขับ ${defaultDriver.name}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
              นับจากวันเปิดงาน {start} ถึง {(() => {
                const end = new Date(endExclusive); end.setDate(end.getDate() - 1)
                return end.toISOString().slice(0, 10)
              })()}{' · '}พิมพ์เมื่อ {db.thaiDate(new Date().toISOString())}
            </div>
          </div>

          {/* Info banners */}
          {crossMonthCount > 0 && (
            <div
              style={{
                padding: '8px 12px', marginBottom: 10, borderRadius: 6, fontSize: 12,
                background: '#FEF3C7', border: '1px solid #F59E0B',
              }}
            >
              ℹ มี <strong>{crossMonthCount}</strong> รอบที่ปิดงานนอกเดือนนี้ — รวมไว้แล้ว (นับตามวันเปิดงาน)
            </div>
          )}
          {abnormalCount > 0 && (
            <div
              className="no-print"
              style={{
                padding: '8px 12px', marginBottom: 10, borderRadius: 6, fontSize: 12,
                background: '#FEE2E2', border: '1px solid #EF4444',
              }}
            >
              ⚠ พบ <strong>{abnormalCount}</strong> รอบผิดปกติ — KM/L &lt; {DSP_KMPL_THRESHOLD}
            </div>
          )}

          {/* Trip table */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="tbl print-compact">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>วันเปิด</th>
                    <th>วันปิด</th>
                    <th>รหัสรอบ</th>
                    <th>รายการ / เส้นทาง</th>
                    <th className="num">น.น.ต้น</th>
                    <th className="num">น.น.ปลาย</th>
                    <th className="num">ค่าบรรทุก</th>
                    <th className="num">จำนวนเงิน</th>
                    <th className="num">เบี้ยเลี้ยง</th>
                    <th className="num">น้ำมัน(ล.)</th>
                    <th className="num">เลขไมล์</th>
                    <th className="num">KM/L</th>
                  </tr>
                </thead>
                <tbody>
                  {legRows.map((r, i) => (
                    <tr key={r.key} style={r.crossMonth ? { background: '#FFFBEB' } : undefined}>
                      <td className="muted">{i + 1}</td>
                      <td className="num muted">{r.depart}</td>
                      <td className="num muted">
                        {r.returnAt || '–'}
                        {r.crossMonth && <span style={{ color: '#B45309', marginLeft: 4 }} title="ปิดงานคนละเดือน">↗</span>}
                      </td>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {r.code}
                        {r.code && r.status === 'draft' && (
                          <span className="badge amber" style={{ fontSize: 9, marginLeft: 4 }}>DRAFT</span>
                        )}
                      </td>
                      <td>{r.cargo}</td>
                      <td className="num">{numFmt(r.weight)}</td>
                      <td className="num">{numFmt(r.deliveredWeight)}</td>
                      <td className="num">{priceFmt(r.price)}</td>
                      <td className="num">{db.fmt(r.amount)}</td>
                      <td className="num">{numFmt(r.perDiem)}</td>
                      <td className="num">{numFmt(r.liters)}</td>
                      <td className="num">{numFmt(r.endOdometer)}</td>
                      <td className="num">
                        {r.kmPerL != null
                          ? <span style={{
                              color: r.kmPerL < DSP_KMPL_THRESHOLD ? '#A32D2D' : '#166534',
                              fontWeight: 600,
                            }}>{r.kmPerL.toFixed(2)}</span>
                          : <span className="muted">–</span>}
                      </td>
                    </tr>
                  ))}
                  {legRows.length === 0 && (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>
                        ไม่มีรอบงานในเดือนนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          {rounds.length > 0 && (
            <div
              style={{
                padding: '12px 16px', marginBottom: 20,
                border: '2px solid #000', borderRadius: 4,
                pageBreakInside: 'avoid', breakInside: 'avoid',
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>
                สรุปรวมเดือน {THAI_MONTHS[month - 1]} พ.ศ. {year + 543}
              </h3>
              <div className="grid-4" style={{ gap: 12, fontSize: 12 }}>
                <div>
                  <div style={{ color: '#666' }}>รวมรอบ</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{rounds.length} รอบ · {legRows.length} เที่ยว</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>ระยะทางรวม</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{db.fmt(totals.distance)} กม.</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>น้ำมันรวม</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                    {db.fmt(totals.liters)} ลิตร
                    {totals.avgKmPerL != null && (
                      <span style={{ fontSize: 11, color: '#666', fontWeight: 400, marginLeft: 6 }}>
                        ({totals.avgKmPerL.toFixed(2)} กม./ล.)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>รายได้รวม</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#166534' }}>{db.thb(totals.revenue)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>ค่าน้ำมัน</div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.thb(totals.fuelCost)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>เบี้ยเลี้ยง</div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.thb(totals.perDiem)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>ค่าใช้จ่ายอื่น</div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.thb(totals.other)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>กำไรสุทธิ</div>
                  <div className="mono" style={{
                    fontSize: 16, fontWeight: 700,
                    color: totals.profit >= 0 ? '#166534' : '#A32D2D',
                  }}>{db.thb(totals.profit)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Signatures */}
          {rounds.length > 0 && (
            <div
              style={{
                marginTop: 40,
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 40,
                pageBreakInside: 'avoid', breakInside: 'avoid',
              }}
            >
              {['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'].map(label => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>{label}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>(.....................................)</div>
                  <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
