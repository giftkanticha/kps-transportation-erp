import { useState, useMemo } from 'react'
import { db, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { usePrint } from '../../hooks/usePrint'
import type { Vehicle, Employee, Dispatch, FuelRound } from '../../types'
import { Icon, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
}

type StatusFilter = 'all' | 'draft' | 'closed'

interface Row {
  round: Dispatch
  vehicle?: Vehicle
  driver?: Employee
  fuelRound: FuelRound | null
  legCount: number
  distance: number
  revenue: number
  fuelCost: number
  perDiemTotal: number
  otherTotal: number
  profit: number
  kmPerL: number | null
  status: 'draft' | 'closed' | 'legacy'
}

function isoMonth(s: string): string {
  return (s || '').slice(0, 7)
}

export function DispatchSummaryReport({ setActive, setSubject }: Props) {
  const today = new Date()
  const [from, setFrom] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`)
  const [to, setTo] = useState(today.toISOString().slice(0, 10))
  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatch = [] } = useDispatches()
  const { data: fuelRounds = [] } = useList<FuelRound>('fuel_rounds')
  const drivers = employees.filter(e => e.position === 'คนขับ')
  const { print } = usePrint()

  const rows = useMemo<Row[]>(() => {
    const rounds = dispatch
      .filter(d => {
        // Only show rounds that participate in the new round model (draft or closed)
        // or legacy completed dispatches
        return d.roundStatus === 'draft' || d.roundStatus === 'closed' || d.status === 'completed'
      })
      .filter(d => {
        const dt = (d.depart || d.date || '').slice(0, 10)
        if (from && dt < from) return false
        if (to && dt > to) return false
        if (vehicleId && d.vehicleId !== vehicleId) return false
        if (driverId && d.driverId !== driverId) return false
        if (status === 'draft' && d.roundStatus !== 'draft') return false
        if (status === 'closed' && d.roundStatus !== 'closed') return false
        return true
      })

    return rounds.map(round => {
      const fuelRound = db.fuelRoundOfDispatch(round.id, fuelRounds)
      const legs = round.legs ?? []
      const revenue = db.roundRevenue(round)
      const perDiemTotal = db.roundPerDiem(round)
      const otherTotal = db.roundOtherExpenses(round)
      const fuelCost = fuelRound ? db.fuelRoundCost(fuelRound) : (round.cost || 0)
      const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (round.liters || 0)
      const distance = db.roundDistance(round)
      const profit = revenue - fuelCost - perDiemTotal - otherTotal
      const kmPerL = consumed > 0 && distance > 0 ? distance / consumed : null
      const statusLabel: Row['status'] =
        round.roundStatus === 'draft' ? 'draft'
          : round.roundStatus === 'closed' ? 'closed'
            : 'legacy'
      return {
        round,
        vehicle: vehicles.find(v => v.id === round.vehicleId),
        driver: employees.find(e => e.id === round.driverId),
        fuelRound,
        legCount: legs.length,
        distance,
        revenue,
        fuelCost,
        perDiemTotal,
        otherTotal,
        profit,
        kmPerL,
        status: statusLabel,
      }
    }).sort((a, b) => (b.round.depart || b.round.date || '').localeCompare(a.round.depart || a.round.date || ''))
  }, [from, to, vehicleId, driverId, status, vehicles, employees, dispatch, fuelRounds])

  // Aggregates
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalFuel = rows.reduce((s, r) => s + r.fuelCost, 0)
  const totalPerDiem = rows.reduce((s, r) => s + r.perDiemTotal, 0)
  const totalOther = rows.reduce((s, r) => s + r.otherTotal, 0)
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0)
  const totalDistance = rows.reduce((s, r) => s + r.distance, 0)
  const abnormal = rows.filter(r => r.kmPerL != null && r.kmPerL < DSP_KMPL_THRESHOLD)
  const months = useMemo(() => {
    const ms = new Set<string>()
    rows.forEach(r => ms.add(isoMonth(r.round.depart || r.round.date || '')))
    return ms.size
  }, [rows])

  // Per-leg "legacy form" rows — only when a single vehicle is selected.
  const legRows = useMemo(() => {
    if (!vehicleId) return []
    const sorted = [...rows].sort((a, b) =>
      (a.round.depart || a.round.date || '').localeCompare(b.round.depart || b.round.date || ''))
    const out: {
      key: string; date: string; plate: string; cargo: string
      weight: number | null; deliveredWeight: number | null; price: number | null
      amount: number; perDiem: number | null
      liters: number | null; endOdometer: number | null; kmPerL: number | null
    }[] = []
    sorted.forEach(r => {
      const date = (r.round.depart || r.round.date || '').slice(0, 10)
      const plate = r.vehicle?.plate ?? '—'
      const legs = r.round.legs ?? []
      if (legs.length === 0) {
        out.push({
          key: r.round.id, date, plate, cargo: '—',
          weight: null, deliveredWeight: null, price: null,
          amount: r.revenue, perDiem: r.perDiemTotal,
          liters: r.round.liters, endOdometer: r.round.endOdometer, kmPerL: r.kmPerL,
        })
        return
      }
      legs.forEach((l, i) => {
        out.push({
          key: `${r.round.id}-${i}`, date, plate,
          cargo: l.cargo || [l.origin, l.destination].filter(Boolean).join('-') || '—',
          weight: l.weight ?? null,
          deliveredWeight: l.deliveredWeight ?? null,
          price: l.price ?? null,
          amount: l.amount || 0,
          perDiem: l.perDiem ?? null,
          liters: i === 0 ? r.round.liters : null,
          endOdometer: i === 0 ? r.round.endOdometer : null,
          kmPerL: i === 0 ? r.kmPerL : null,
        })
      })
    })
    return out
  }, [rows, vehicleId])

  const formTotals = legRows.reduce(
    (a, r) => ({
      amount: a.amount + (r.amount || 0),
      perDiem: a.perDiem + (r.perDiem || 0),
      liters: a.liters + (r.liters || 0),
    }),
    { amount: 0, perDiem: 0, liters: 0 },
  )

  const selVehicle = vehicles.find(v => v.id === vehicleId)
  const numFmt = (v: number | null | undefined) => (v != null && v !== 0 ? db.fmt(v) : '–')
  const priceFmt = (v: number | null | undefined) =>
    v != null && v !== 0 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '–'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานสรุปงานขนส่ง</h1>
          <div className="page-sub">รายงาน P&amp;L ต่อรอบ พร้อม highlight KM/L &lt; {DSP_KMPL_THRESHOLD}</div>
        </div>
        <div className="actions no-print">
          <button className="btn" onClick={() => print('landscape')}>
            <Icon name="download" size={15} /> พิมพ์ / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad no-print" style={{ marginBottom: 16 }}>
        <div className="grid-4" style={{ gap: 12 }}>
          <Field label="จาก">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึง">
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </Field>
          <Field label="รถ">
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
            </select>
          </Field>
          <Field label="คนขับ">
            <select value={driverId} onChange={e => setDriverId(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 14 }}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>สถานะ:</span>
          {(['all', 'draft', 'closed'] as StatusFilter[]).map(s => (
            <label key={s} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" checked={status === s} onChange={() => setStatus(s)} />
              <span>{s === 'all' ? 'ทั้งหมด' : s === 'draft' ? 'DRAFT' : 'CLOSED'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid-4" style={{ marginBottom: 16, gap: 12 }}>
        <div className="card kpi">
          <div className="label">รายได้รวม</div>
          <div className="row"><div className="icn-box green"><Icon name="money" size={18} /></div>
            <div className="value">{db.thb(totalRevenue)}</div></div>
        </div>
        <div className="card kpi">
          <div className="label">ต้นทุนรวม</div>
          <div className="row"><div className="icn-box amber"><Icon name="wallet" size={18} /></div>
            <div className="value">{db.thb(totalFuel + totalPerDiem + totalOther)}</div></div>
        </div>
        <div className="card kpi">
          <div className="label">กำไรสุทธิ</div>
          <div className="row">
            <div className={`icn-box ${totalProfit >= 0 ? 'green' : 'red'}`}><Icon name="chart" size={18} /></div>
            <div className="value" style={{ color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {db.thb(totalProfit)}
            </div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ระยะทางรวม</div>
          <div className="row"><div className="icn-box"><Icon name="gauge" size={18} /></div>
            <div className="value">{db.fmt(totalDistance)}<span className="unit">km</span></div></div>
        </div>
      </div>

      {abnormal.length > 0 && (
        <div
          style={{
            padding: 12, marginBottom: 14, borderRadius: 8,
            background: '#FEE2E2', border: '1px solid #EF4444', fontSize: 13,
          }}
        >
          ⚠️ พบ <strong>{abnormal.length}</strong> เที่ยวผิดปกติ — KM/L ต่ำกว่าเกณฑ์ {DSP_KMPL_THRESHOLD}
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="head">
          <h3>รายการรอบงาน ({rows.length} รอบ · {months} เดือน)</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>วันที่</th>
                <th>รถ</th>
                <th>คนขับ</th>
                <th className="num">ขา</th>
                <th className="num">ระยะทาง</th>
                <th className="num">รายได้</th>
                <th className="num">น้ำมัน</th>
                <th className="num">กำไร</th>
                <th className="num">KM/L</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const low = r.kmPerL != null && r.kmPerL < DSP_KMPL_THRESHOLD
                return (
                  <tr
                    key={r.round.id}
                    style={{
                      cursor: 'pointer',
                      background: low ? '#FEE2E2' : undefined,
                    }}
                    onClick={() => {
                      setSubject({ type: 'round', id: r.round.id })
                      setActive('dispatch.round')
                    }}
                  >
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.round.code}</td>
                    <td className="num muted">{(r.round.depart || r.round.date || '').slice(0, 10)}</td>
                    <td className="mono">{r.vehicle?.plate ?? '—'}</td>
                    <td>{r.driver?.name ?? '—'}</td>
                    <td className="num">{r.legCount}</td>
                    <td className="num">{db.fmt(r.distance)}</td>
                    <td className="num">{db.thb(r.revenue)}</td>
                    <td className="num">{db.thb(r.fuelCost)}</td>
                    <td className="num" style={{ color: r.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {db.thb(r.profit)}
                    </td>
                    <td className="num">
                      {r.kmPerL != null
                        ? (
                          <span
                            className="badge"
                            style={{
                              background: low ? '#FEE2E2' : '#DCFCE7',
                              color: low ? '#991B1B' : '#166534',
                              fontSize: 11,
                            }}
                          >
                            {r.kmPerL.toFixed(2)} {low && '⚠️'}
                          </span>
                        )
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {r.status === 'closed'
                        ? <span className="badge green" style={{ fontSize: 11 }}>CLOSED</span>
                        : r.status === 'draft'
                          ? <span className="badge amber" style={{ fontSize: 11 }}>DRAFT</span>
                          : <span className="badge" style={{ fontSize: 11 }}>LEGACY</span>}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 36, color: 'var(--text-2)' }}>
                    ไม่พบรายการในช่วงเวลาที่เลือก
                  </td>
                </tr>
              )}
              {rows.length > 0 && (
                <tr style={{ fontWeight: 600, background: 'var(--bg)' }}>
                  <td colSpan={5} className="right">รวม {rows.length} รอบ</td>
                  <td className="num">{db.fmt(totalDistance)}</td>
                  <td className="num">{db.thb(totalRevenue)}</td>
                  <td className="num">{db.thb(totalFuel)}</td>
                  <td className="num" style={{ color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {db.thb(totalProfit)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legacy per-trip form — only when a single vehicle is selected */}
      {vehicleId && (
        <>
          <div className="print-only" style={{ marginBottom: 12 }}>
            <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>รายงานรายเที่ยว</div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 4 }}>
              KPS Transportation ERP · ทะเบียน {selVehicle?.plate ?? '—'} · {from} – {to} · พิมพ์เมื่อ {db.thaiDate(new Date().toISOString())}
            </div>
          </div>

          <div className="card print-area">
            <div className="head no-print">
              <h3>แบบฟอร์มรายเที่ยว — {selVehicle?.plate ?? '—'} ({legRows.length} เที่ยว)</h3>
            </div>
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="tbl print-compact">
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>ทะเบียน</th>
                    <th>รายการ</th>
                    <th className="num">น.น.ต้นทาง</th>
                    <th className="num">น.น.ปลายทาง</th>
                    <th className="num">ค่าบรรทุก</th>
                    <th className="num">จำนวนเงิน</th>
                    <th className="num">เบี้ยเลี้ยง</th>
                    <th className="num">น้ำมันที่เติม</th>
                    <th className="num">เข็มไมล์</th>
                    <th className="num">อัตราการวิ่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {legRows.map(r => (
                    <tr key={r.key}>
                      <td className="num muted">{r.date}</td>
                      <td className="mono">{r.plate}</td>
                      <td>{r.cargo}</td>
                      <td className="num">{numFmt(r.weight)}</td>
                      <td className="num">{numFmt(r.deliveredWeight)}</td>
                      <td className="num">{priceFmt(r.price)}</td>
                      <td className="num">{db.fmt(r.amount)}</td>
                      <td className="num">{numFmt(r.perDiem)}</td>
                      <td className="num">{numFmt(r.liters)}</td>
                      <td className="num">{numFmt(r.endOdometer)}</td>
                      <td className="num">{r.kmPerL != null ? r.kmPerL.toFixed(2) : '–'}</td>
                    </tr>
                  ))}
                  {legRows.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: 24, color: 'var(--text-2)' }}>
                        ไม่พบเที่ยวในช่วงเวลาที่เลือก
                      </td>
                    </tr>
                  )}
                  {legRows.length > 0 && (
                    <tr style={{ fontWeight: 600, background: 'var(--bg)' }}>
                      <td colSpan={6} className="right">รวม {legRows.length} เที่ยว</td>
                      <td className="num">{db.fmt(formTotals.amount)}</td>
                      <td className="num">{db.fmt(formTotals.perDiem)}</td>
                      <td className="num">{db.fmt(formTotals.liters)}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
