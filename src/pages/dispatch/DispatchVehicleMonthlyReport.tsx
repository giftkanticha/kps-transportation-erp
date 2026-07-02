import { useState, useMemo } from 'react'
import { db, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { useAccountingPeriods, findPeriod } from '../../hooks/useAccountingPeriods'
import { usePrint } from '../../hooks/usePrint'
import type { Vehicle, Employee, Dispatch, FuelRound, AccountingPeriodSnapshot } from '../../types'
import { Icon, Field, FontScaleControl } from '../../components/ui'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

type StatusFilter = 'closed' | 'all'

interface LegRow {
  key: string
  loadDate: string
  unloadDate: string
  crossMonth: boolean
  code: string
  status: 'draft' | 'closed' | 'legacy'
  cargo: string
  weight: number | null
  deliveredWeight: number | null
  price: number | null
  priceMode?: 'per_ton' | 'per_kg' | 'lump'
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
  const [showWht, setShowWht] = useState(true)  // หักภาษี ณ ที่จ่าย 1% ออกจากกำไร (ให้ตรงยอดโอน)

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatch = [] } = useDispatches()
  const { data: fuelRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { data: periods = [] } = useAccountingPeriods()
  const { data: snapshots = [] } = useList<AccountingPeriodSnapshot>('accounting_period_snapshots')
  const { print } = usePrint()

  const { start, endExclusive } = monthBounds(year, month)
  const selVehicle = vehicles.find(v => v.id === vehicleId)
  const defaultDriver = employees.find(e => e.id === selVehicle?.driverId)
  const period = findPeriod(periods, year, month)
  const isPeriodClosed = period?.status === 'CLOSED'
  const snapshot = isPeriodClosed && vehicleId
    ? snapshots.find(s => s.periodId === period?.id && s.vehicleId === vehicleId)
    : null

  // รอบที่อยู่ในงวด/เดือนที่เลือก + เป็นรถคันนั้น
  // ยึดงวดบัญชีแบบเดียวกับหน้า P&L รายคัน (FinancePL → dispatchInPeriod):
  //   - ถ้ารอบถูกกำหนดงวด (accountingPeriodId) และมีงวดของเดือนนี้ → ยึดตามงวด
  //     (รองรับการยกยอดข้ามเดือน — carry-forward)
  //   - มิฉะนั้น fallback ไปที่วันเปิดงาน (depart || date) ให้ตกในเดือนที่เลือก
  const rounds = useMemo<Dispatch[]>(() => {
    if (!vehicleId) return []
    return dispatch
      .filter(d => d.vehicleId === vehicleId)
      .filter(d => {
        if (d.accountingPeriodId && period) return d.accountingPeriodId === period.id
        const basis = (d.depart || d.date || '').slice(0, 10)
        if (!basis) return false
        return basis >= start && basis < endExclusive
      })
      .filter(d => {
        if (statusFilter === 'closed') return d.roundStatus === 'closed' || d.status === 'completed'
        return d.roundStatus === 'draft' || d.roundStatus === 'closed' || d.status === 'completed'
      })
      .sort((a, b) => (a.depart || a.date || '').localeCompare(b.depart || b.date || ''))
  }, [dispatch, vehicleId, start, endExclusive, statusFilter, period])

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
          loadDate: depart10,
          unloadDate: returnAt10,
          crossMonth,
          code: r.code,
          status,
          cargo: '',
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
          loadDate: l.loadDate || depart10,
          unloadDate: l.unloadDate || (i === 0 ? returnAt10 : ''),
          crossMonth: i === 0 ? crossMonth : false,
          code: i === 0 ? r.code : '',
          status: i === 0 ? status : status,
          cargo: l.cargo || [l.origin, l.destination].filter(Boolean).join(' - ') || '',
          weight: l.weight ?? null,
          deliveredWeight: l.deliveredWeight ?? null,
          price: l.price ?? null,
          priceMode: l.priceMode,
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
    // เมื่อปิดงวดแล้ว → อ่านจาก snapshot (ตัวเลข final, ไม่คำนวณใหม่)
    // WHT 1% ของเดือนนี้ (ยอดเต็มเป็นค่าหลัก; WHT เป็นรายการแยก คิดจากรอบเสมอ)
    const wht = rounds.reduce((s, r) => s + db.roundWht(r), 0)
    if (snapshot) {
      const d = snapshot.data
      return {
        revenue: d.revenue, fuelCost: d.fuelCost, perDiem: d.perDiem, other: d.other,
        profit: d.profit, distance: d.distance, liters: d.liters, avgKmPerL: d.avgKmPerL, wht,
      }
    }
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
    return { revenue, fuelCost, perDiem, other, profit, distance, liters, avgKmPerL, wht }
  }, [rounds, fuelRounds, snapshot])

  // WHT สะสมทั้งปีของรถคันนี้ (ภาษีถูกหัก ณ ที่จ่าย รอเครดิตคืน) — นับตามวันเปิดงาน
  const whtYear = useMemo(() => {
    if (!vehicleId) return 0
    return dispatch
      .filter(d => d.vehicleId === vehicleId)
      .filter(d => d.roundStatus === 'closed' || d.status === 'completed')
      .filter(d => (d.depart || d.date || '').slice(0, 4) === String(year))
      .reduce((s, d) => s + db.roundWht(d), 0)
  }, [dispatch, vehicleId, year])

  // กำไรสุทธิที่แสดง: ถ้าเปิด "หัก 1%" ให้ลบ WHT ออก → ตรงยอดเงินโอนเข้าจริง
  const netProfit = showWht ? totals.profit - totals.wht : totals.profit

  const crossMonthCount = legRows.filter(r => r.crossMonth).length
  const abnormalCount = rounds.filter(r => {
    const fuelRound = db.fuelRoundOfDispatch(r.id, fuelRounds)
    const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (r.liters || 0)
    const dist = db.roundDistance(r)
    const kmPerL = consumed > 0 && dist > 0 ? dist / consumed : null
    return kmPerL != null && kmPerL < DSP_KMPL_THRESHOLD
  }).length

  const numFmt = (v: number | null | undefined) => (v != null && v !== 0 ? db.fmt(v) : '')
  const priceFmt = (v: number | null | undefined) =>
    v != null && v !== 0 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''
  // Weight is stored canonically in ตัน. Display it in the unit actually used to
  // price the leg (per_kg → กก. = ตัน×1000, otherwise ตัน) so weight × ค่าบรรทุก
  // matches จำนวนเงิน. No unit label — the magnitude implies tons vs kg.
  const weightFmt = (v: number | null | undefined, mode?: LegRow['priceMode']) => {
    if (v == null || v === 0) return ''
    const val = mode === 'per_kg' ? v * 1000 : v
    return val.toLocaleString('en-US', { maximumFractionDigits: 3 })
  }

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุปรายเที่ยวรายเดือน (ต่อคัน)</h1>
          <div className="page-sub">
            เลือกทะเบียน + เดือน — นับตาม <strong>งวดบัญชี</strong> เหมือนหน้า P&L รายคัน: รอบที่ถูกยกยอดเข้างวดยึดตามงวด ที่เหลือยึด<strong>วันเปิดงาน</strong> (เที่ยวคร่อมเดือนยังคงอยู่ในเดือนที่เปิด)
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FontScaleControl />
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
              {vehicles
                .filter(v => (v.groupKind ?? 'TRANSPORT') === 'TRANSPORT')
                .map(v => (
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
          <label className="row" style={{ gap: 7, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showWht} onChange={e => setShowWht(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
            <span>หักภาษี ณ ที่จ่าย 1% ออกจากกำไร (ให้ตรงยอดโอน)</span>
          </label>
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

          {/* Period status banner */}
          {isPeriodClosed && (
            <div
              style={{
                padding: '8px 12px', marginBottom: 10, borderRadius: 6, fontSize: 12,
                background: '#DCFCE7', border: '1px solid #16A34A',
              }}
            >
              🔒 <strong>งวดนี้ปิดบัญชีแล้ว</strong>
              {period?.closedAt && ` · ปิดเมื่อ ${db.thaiDate(period.closedAt)}`}
              {period?.closedByName && ` โดย ${period.closedByName}`}
              {snapshot && ' · ตัวเลขจาก snapshot (ไม่เปลี่ยนแม้ dispatch ถูกแก้)'}
            </div>
          )}

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
                    <th>วันที่ขึ้น</th>
                    <th>วันที่ลง</th>
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
                      <td className="num muted">{r.loadDate}</td>
                      <td className="num muted">
                        {r.unloadDate || ''}
                        {r.crossMonth && <span style={{ color: '#B45309', marginLeft: 4 }} title="ปิดงานคนละเดือน">↗</span>}
                      </td>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {r.code}
                        {r.code && r.status === 'draft' && (
                          <span className="badge amber" style={{ fontSize: 9, marginLeft: 4 }}>DRAFT</span>
                        )}
                      </td>
                      <td>{r.cargo}</td>
                      <td className="num">{weightFmt(r.weight, r.priceMode)}</td>
                      <td className="num">{weightFmt(r.deliveredWeight, r.priceMode)}</td>
                      <td className="num">{priceFmt(r.price)}</td>
                      <td className="num">{db.fmt(r.amount)}</td>
                      <td className="num">{numFmt(r.perDiem)}</td>
                      <td className="num">{numFmt(r.liters)}</td>
                      <td className="num">{numFmt(r.endOdometer)}</td>
                      <td className="num">
                        {r.kmPerL != null && (
                          <span style={{
                            color: r.kmPerL < DSP_KMPL_THRESHOLD ? '#A32D2D' : '#166534',
                            fontWeight: 600,
                          }}>{r.kmPerL.toFixed(2)}</span>
                        )}
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

          {/* Totals — compact 1-row summary */}
          {rounds.length > 0 && (
            <div
              style={{
                padding: '6px 10px',
                border: '1px solid #000', borderRadius: 3,
                fontSize: 11, lineHeight: 1.5,
                display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
                alignItems: 'baseline',
                pageBreakInside: 'avoid', breakInside: 'avoid',
              }}
            >
              <strong style={{ fontSize: 12 }}>สรุปรวม:</strong>
              <span><span style={{ color: '#666' }}>รอบ </span><strong>{rounds.length}</strong> · <span style={{ color: '#666' }}>เที่ยว </span><strong>{legRows.length}</strong></span>
              <span><span style={{ color: '#666' }}>ระยะทาง </span><strong className="mono">{db.fmt(totals.distance)}</strong> กม.</span>
              <span>
                <span style={{ color: '#666' }}>น้ำมัน </span><strong className="mono">{db.fmt(totals.liters)}</strong> ล.
                {totals.avgKmPerL != null && <span style={{ color: '#666' }}> ({totals.avgKmPerL.toFixed(2)} กม./ล.)</span>}
              </span>
              <span><span style={{ color: '#666' }}>รายได้ </span><strong className="mono" style={{ color: '#166534' }}>{db.thb(totals.revenue)}</strong></span>
              <span><span style={{ color: '#666' }}>ค่าน้ำมัน </span><strong className="mono">{db.thb(totals.fuelCost)}</strong></span>
              <span><span style={{ color: '#666' }}>เบี้ยเลี้ยง </span><strong className="mono">{db.thb(totals.perDiem)}</strong></span>
              <span><span style={{ color: '#666' }}>อื่นๆ </span><strong className="mono">{db.thb(totals.other)}</strong></span>
              {showWht && totals.wht > 0 && (
                <span><span style={{ color: '#666' }}>หัก ณ ที่จ่าย 1% </span><strong className="mono" style={{ color: '#A32D2D' }}>− {db.thb(totals.wht)}</strong></span>
              )}
              <span style={{ marginLeft: 'auto' }}>
                <span style={{ color: '#666' }}>{showWht ? 'กำไร (เงินรับจริง) ' : 'กำไรสุทธิ '}</span>
                <strong className="mono" style={{
                  fontSize: 13,
                  color: netProfit >= 0 ? '#166534' : '#A32D2D',
                }}>{db.thb(netProfit)}</strong>
              </span>
            </div>
          )}
          {whtYear > 0 && (
            <div className="mono" style={{ fontSize: 11.5, color: '#92400E', marginTop: 6, textAlign: 'right' }}>
              WHT สะสมทั้งปี {year + 543} (ภาษีถูกหัก ณ ที่จ่าย รอเครดิตคืน): {db.thb(whtYear)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
