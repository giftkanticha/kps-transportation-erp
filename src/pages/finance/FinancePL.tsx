import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import { Icon } from '../../components/ui'
import type { Vehicle, Dispatch, FuelRecord, Maintenance, Expense, FixedCost, Employee } from '../../types'

/* ────────────────────────────────────────────────────────────────────────── */
/* Formatters & date helpers                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

// Always 2 decimals, comma thousands.
function fmt2(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0.00'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// Buddhist-year (พ.ศ.) month label, e.g. "พฤษภาคม 2569"
const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
function thaiMonthLabel(year: number, month: number): string {
  return `${THAI_MONTHS_FULL[month]} ${year + 543}`
}

// Returns YYYY-MM prefix for an ISO date (handles bad input).
function ymKey(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Days from today until target ISO date (negative if past).
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Computation                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

interface VehicleRow {
  v: Vehicle
  driverName: string
  rev: number
  fuel: number
  allowance: number
  salary: number
  maintTire: number
  fixed: number
  totalCost: number
  profit: number
}

interface AlertItem {
  kind: 'tax' | 'insurance' | 'permit' | 'license'
  label: string
  ref: string // plate or employee name
  expireDate: string
  daysLeft: number
}

function computeRows(
  vehicles: Vehicle[],
  dispatches: Dispatch[],
  fuel: FuelRecord[],
  maint: Maintenance[],
  expenses: Expense[],
  fixedCosts: FixedCost[],
  employees: Employee[],
  ym: string,
  query: string,
): VehicleRow[] {
  // Pre-compute driver → vehicleCount for fair salary split
  const driverVehicleCount: Record<string, number> = {}
  for (const v of vehicles) {
    if (v.driverId) driverVehicleCount[v.driverId] = (driverVehicleCount[v.driverId] ?? 0) + 1
  }
  const q = query.trim().toLowerCase()

  return vehicles
    .filter(v => !q || v.plate.toLowerCase().includes(q) || v.brand.toLowerCase().includes(q))
    .map(v => {
      // Revenue: sum dispatch.revenue (or totalAmount fallback) for this vehicle in the selected month
      const myDispatches = dispatches.filter(d => d.vehicleId === v.id && ymKey(d.date) === ym)
      const rev = myDispatches.reduce((s, d) => s + (d.revenue ?? d.totalAmount ?? 0), 0)
      const allowance = myDispatches.reduce((s, d) => {
        const fromLegs = (d.legs ?? []).reduce((ss, l) => ss + (l.perDiem ?? 0), 0)
        return s + (fromLegs > 0 ? fromLegs : (d.perDiem ?? 0))
      }, 0)
      // Fuel cost: dispatch.cost (fuel cost recorded at close) + FuelRecord linked by vehicle in month
      const dispatchFuel = myDispatches.reduce((s, d) => s + (d.cost ?? 0), 0)
      const fuelLogs = fuel.filter(f => f.vehicleId === v.id && ymKey(f.date) === ym)
        .reduce((s, f) => s + (f.total ?? 0), 0)
      const fuelTotal = dispatchFuel + fuelLogs
      // Maintenance + Tires + misc Expense (operational)
      const maintTotal = maint.filter(m => m.vehicleId === v.id && ymKey(m.startDate) === ym)
        .reduce((s, m) => s + (m.cost ?? 0), 0)
      const expTotal = expenses.filter(x => x.vehicleId === v.id && ymKey(x.date) === ym)
        .reduce((s, x) => s + (x.amount ?? 0), 0)
      // Driver salary — split equally among assigned vehicles to avoid double-counting at totals
      const driver = v.driverId ? employees.find(e => e.id === v.driverId) : undefined
      const driverName = driver?.name ?? '—'
      const driverSalaryShare = driver && driverVehicleCount[driver.id]
        ? (driver.salary ?? 0) / driverVehicleCount[driver.id]
        : 0
      // Fixed costs assigned to this vehicle
      const fixed = fixedCosts.filter(f => f.vehicleId === v.id).reduce((s, f) => s + (f.monthly ?? 0), 0)

      const totalCost = fuelTotal + allowance + driverSalaryShare + maintTotal + expTotal + fixed
      return {
        v,
        driverName,
        rev,
        fuel: fuelTotal,
        allowance,
        salary: driverSalaryShare,
        maintTire: maintTotal + expTotal,
        fixed,
        totalCost,
        profit: rev - totalCost,
      }
    })
}

function computeAlerts(vehicles: Vehicle[], employees: Employee[], windowDays = 30): AlertItem[] {
  const items: AlertItem[] = []
  for (const v of vehicles) {
    const checks: Array<[AlertItem['kind'], string, string | undefined]> = [
      ['tax', 'ภาษีรถยนต์', v.tax],
      ['insurance', 'ประกันภัย', v.insurance],
      ['permit', 'ใบอนุญาตขนส่ง', v.dispatchPermit],
    ]
    for (const [kind, label, date] of checks) {
      const days = daysUntil(date)
      if (days != null && days <= windowDays) {
        items.push({ kind, label, ref: v.plate, expireDate: date as string, daysLeft: days })
      }
    }
  }
  for (const e of employees) {
    if (e.position !== 'คนขับ') continue
    if (e.licenseStatus === 'expired') {
      items.push({ kind: 'license', label: 'ใบขับขี่', ref: e.name, expireDate: e.licenseExpire || '—', daysLeft: -1 })
    } else if (e.licenseStatus === 'warning' && e.licenseExpire) {
      const days = daysUntil(e.licenseExpire)
      if (days != null && days <= windowDays) {
        items.push({ kind: 'license', label: 'ใบขับขี่', ref: e.name, expireDate: e.licenseExpire, daysLeft: days })
      }
    }
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft)
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function MetricCard({
  label, value, tone, icon, subtitle,
}: {
  label: string
  value: string
  tone: 'green' | 'red' | 'blue' | 'amber'
  icon: string
  subtitle?: string
}) {
  const color = tone === 'green' ? '#10B981' : tone === 'red' ? '#EF4444' : tone === 'amber' ? '#D97706' : 'var(--primary)'
  const bg = tone === 'green' ? '#DCFCE7' : tone === 'red' ? '#FEE2E2' : tone === 'amber' ? '#FEF3C7' : 'var(--primary-50)'
  return (
    <div className="card" style={{ padding: '16px 18px', background: '#ffffff' }}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 8,
            background: bg, color, display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        ><Icon name={icon} size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2, letterSpacing: '-.01em' }}>
            {value} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>บาท</span>
          </div>
          {subtitle && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
    </div>
  )
}

function AlertCenter({ alerts }: { alerts: AlertItem[] }) {
  return (
    <div className="card" style={{ background: '#ffffff', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="head">
        <h3>
          <Icon name="alert" size={16} /> ศูนย์แจ้งเตือนเอกสารหมดอายุ
        </h3>
        <div className="right">
          <span className="badge" style={{ background: alerts.length > 0 ? '#FEE2E2' : '#DCFCE7', color: alerts.length > 0 ? '#991B1B' : '#166534', fontSize: 11 }}>
            {alerts.length} รายการ
          </span>
        </div>
      </div>
      <div style={{ padding: alerts.length ? 0 : 18, flex: 1, overflow: 'auto', maxHeight: 320 }}>
        {alerts.length === 0 ? (
          <div className="empty" style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            ✓ ไม่มีเอกสารที่ใกล้หมดอายุภายใน 30 วัน
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {alerts.map((a, i) => {
              const overdue = a.daysLeft < 0
              const urgent = a.daysLeft <= 7
              const tone = overdue ? '#DC2626' : urgent ? '#D97706' : '#0EA5E9'
              const bg = overdue ? '#FEE2E2' : urgent ? '#FEF3C7' : '#DBEAFE'
              return (
                <li
                  key={i}
                  style={{
                    padding: '10px 18px',
                    borderBottom: i < alerts.length - 1 ? '1px solid var(--line)' : 'none',
                    display: 'flex', gap: 12, alignItems: 'center', fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0, width: 32, height: 32, borderRadius: 6,
                      background: bg, color: tone, display: 'grid', placeItems: 'center',
                    }}
                  ><Icon name={overdue ? 'close' : 'alert'} size={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                      {a.label} <span className="mono" style={{ color: 'var(--primary)' }}>{a.ref}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>
                      หมดอายุ {db.thaiDate(a.expireDate)}
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontWeight: 600, fontSize: 12,
                      padding: '3px 8px', borderRadius: 999,
                      background: bg, color: tone, whiteSpace: 'nowrap',
                    }}
                  >{overdue ? `เลย ${Math.abs(a.daysLeft)} วัน` : `${a.daysLeft} วัน`}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Main page                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function FinancePL() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [query, setQuery] = useState('')

  const ym = `${year}-${String(month + 1).padStart(2, '0')}`

  // Real-time aggregation from localStorage db (single source of truth — no duplicated totals stored)
  const { rows, alerts, totals, vehicleCount } = useMemo(() => {
    try {
      const vehicles = db.getAll<Vehicle>('vehicles')
      const dispatches = db.getAll<Dispatch>('dispatch')
      const fuel = db.getAll<FuelRecord>('fuel')
      const maint = db.getAll<Maintenance>('maintenance')
      const expenses = db.getAll<Expense>('expenses')
      const fixedCosts = db.getAll<FixedCost>('fixedCosts')
      const employees = db.getAll<Employee>('employees')
      const rs = computeRows(vehicles, dispatches, fuel, maint, expenses, fixedCosts, employees, ym, query)
      const al = computeAlerts(vehicles, employees)
      const t = rs.reduce(
        (acc, r) => ({
          rev: acc.rev + r.rev,
          fuel: acc.fuel + r.fuel,
          allowance: acc.allowance + r.allowance,
          salary: acc.salary + r.salary,
          maintTire: acc.maintTire + r.maintTire,
          fixed: acc.fixed + r.fixed,
          totalCost: acc.totalCost + r.totalCost,
          profit: acc.profit + r.profit,
        }),
        { rev: 0, fuel: 0, allowance: 0, salary: 0, maintTire: 0, fixed: 0, totalCost: 0, profit: 0 },
      )
      return { rows: rs, alerts: al, totals: t, vehicleCount: vehicles.length }
    } catch (err) {
      // Defensive: prevent crash if a record is malformed
      console.error('FinancePL aggregation failed', err)
      return {
        rows: [], alerts: [], vehicleCount: 0,
        totals: { rev: 0, fuel: 0, allowance: 0, salary: 0, maintTire: 0, fixed: 0, totalCost: 0, profit: 0 },
      }
    }
  }, [ym, query])

  const isProfit = totals.profit >= 0
  const yearOptions = useMemo(() => {
    const cur = today.getFullYear()
    return [cur - 1, cur, cur + 1]
  }, [])

  const onPrint = () => window.print()

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">P&amp;L รายคัน</h1>
          <div className="page-sub">
            กำไร-ขาดทุนรายคัน · {thaiMonthLabel(year, month)} ·{' '}
            <span className="mono">{vehicleCount} คัน</span>
          </div>
        </div>
      </div>

      {/* ── ส่วนที่ 1: Summary cards + Alert center ── */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 16, marginBottom: 16,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'start' }}>
          <MetricCard
            label="รายรับรวม (ประจำเดือน)"
            value={fmt2(totals.rev)}
            tone="blue"
            icon="money"
            subtitle={`จาก ${rows.length} คันที่มีรายการ`}
          />
          <MetricCard
            label="รายจ่ายรวม (ประจำเดือน)"
            value={fmt2(totals.totalCost)}
            tone="red"
            icon="wallet"
            subtitle="น้ำมัน+เบี้ยเลี้ยง+เงินเดือน+ซ่อม+คงที่"
          />
          <MetricCard
            label={isProfit ? 'กำไรสุทธิรวม' : 'ขาดทุนสุทธิรวม'}
            value={fmt2(totals.profit)}
            tone={isProfit ? 'green' : 'red'}
            icon="chart"
            subtitle={totals.rev > 0 ? `Margin ${((totals.profit / totals.rev) * 100).toFixed(1)}%` : 'ยังไม่มีรายรับ'}
          />
        </div>
        <AlertCenter alerts={alerts} />
      </div>

      {/* ── ส่วนที่ 2: Filters & actions ── */}
      <div
        className="card pad no-print"
        style={{ marginBottom: 16, background: '#ffffff' }}
      >
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Icon name="search" size={14} />
            </span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ค้นหาทะเบียนรถ / ยี่ห้อ"
              style={{ paddingLeft: 32, width: '100%' }}
            />
          </div>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ minWidth: 140 }}
          >
            {THAI_MONTHS_FULL.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ minWidth: 110 }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y + 543}</option>
            ))}
          </select>
          <button className="btn primary" onClick={onPrint}>
            <Icon name="download" size={15} /> พิมพ์รายงานสรุป
          </button>
        </div>
      </div>

      {/* ── Print-only header ── */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#000' }}>
          รายงาน P&amp;L รายคัน — {thaiMonthLabel(year, month)}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 4 }}>
          KPS Transportation ERP · พิมพ์เมื่อ {db.thaiDate(new Date().toISOString())}
        </div>
      </div>

      {/* ── ส่วนที่ 3: P&L table ── */}
      <div className="card print-area" style={{ background: '#ffffff' }}>
        <div className="head no-print">
          <h3><Icon name="chart" size={16} /> ตาราง P&amp;L รายคัน ({rows.length})</h3>
        </div>
        {rows.length === 0 ? (
          <div className="empty" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            ไม่พบข้อมูลในเดือน {thaiMonthLabel(year, month)}
          </div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>ทะเบียนรถ</th>
                  <th>คนขับ</th>
                  <th className="num right">รายรับ</th>
                  <th className="num right">ค่าน้ำมัน</th>
                  <th className="num right">เบี้ยเลี้ยง</th>
                  <th className="num right">เงินเดือนคนขับ</th>
                  <th className="num right">ซ่อม+ยาง</th>
                  <th className="num right">Fixed Costs</th>
                  <th className="num right" style={{ fontWeight: 700 }}>กำไรสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const profitColor = r.profit >= 0 ? '#10B981' : '#EF4444'
                  return (
                    <tr key={r.v.id}>
                      <td>
                        <div className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.v.plate}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{r.v.type} · {r.v.brand}</div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{r.driverName}</td>
                      <td className="num right mono" style={{ fontWeight: 600 }}>{fmt2(r.rev)}</td>
                      <td className="num right mono">{fmt2(r.fuel)}</td>
                      <td className="num right mono">{fmt2(r.allowance)}</td>
                      <td className="num right mono">{fmt2(r.salary)}</td>
                      <td className="num right mono">{fmt2(r.maintTire)}</td>
                      <td className="num right mono">{fmt2(r.fixed)}</td>
                      <td className="num right mono" style={{ fontWeight: 700, color: profitColor }}>
                        {fmt2(r.profit)}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--bg-sunk)', fontWeight: 700 }}>
                  <td colSpan={2}>รวมทั้งหมด</td>
                  <td className="num right mono">{fmt2(totals.rev)}</td>
                  <td className="num right mono">{fmt2(totals.fuel)}</td>
                  <td className="num right mono">{fmt2(totals.allowance)}</td>
                  <td className="num right mono">{fmt2(totals.salary)}</td>
                  <td className="num right mono">{fmt2(totals.maintTire)}</td>
                  <td className="num right mono">{fmt2(totals.fixed)}</td>
                  <td className="num right mono" style={{ color: isProfit ? '#10B981' : '#EF4444' }}>
                    {fmt2(totals.profit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print footer note */}
      <div className="print-only" style={{ marginTop: 12, fontSize: 10, color: '#666', textAlign: 'center' }}>
        * รายงานนี้สร้างจากข้อมูล Real-time ผ่านการ Aggregate Join — ไม่มีการบันทึกยอดรวมซ้ำซ้อน
      </div>
    </div>
  )
}
