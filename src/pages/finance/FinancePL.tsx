import { useState, useMemo, useRef, useEffect } from 'react'
import { db } from '../../lib/db'
import { Icon } from '../../components/ui'
import type { Vehicle, Dispatch, FuelRecord, Maintenance, Expense, FixedCost, Employee } from '../../types'

/* ─────────────────────────────────────────────────── helpers ── */

function fmt2(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0.00'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function thaiMonthLabel(year: number, month: number): string {
  return `${THAI_MONTHS_FULL[month]} ${year + 543}`
}

function ymKey(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Station is internal if it exactly equals 'ถังโรงงาน'
function isFactoryStation(station: string): boolean {
  return station === 'ถังโรงงาน'
}

/* ─────────────────────────────────────────────── data model ── */

interface VehicleRow {
  v: Vehicle
  driverName: string
  rev: number
  fuelIn: number    // น้ำมันในโรงงาน — FuelRecord where station === 'ถังโรงงาน'
  fuelOut: number   // น้ำมันนอก — FuelRecord where station !== 'ถังโรงงาน'
  allowance: number
  salary: number
  expense: number   // ค่าใช้จ่าย = maintenance + misc expenses
  interest: number  // ดอกเบี้ย — FixedCost where category === 'ดอกเบี้ย'
  totalCost: number
  profit: number
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
): VehicleRow[] {
  const driverVehicleCount: Record<string, number> = {}
  for (const v of vehicles) {
    if (v.driverId) driverVehicleCount[v.driverId] = (driverVehicleCount[v.driverId] ?? 0) + 1
  }

  return vehicles.map(v => {
    const myDispatches = dispatches.filter(d => d.vehicleId === v.id && ymKey(d.date) === ym)
    const rev = myDispatches.reduce((s, d) => s + (d.revenue ?? d.totalAmount ?? 0), 0)
    const allowance = myDispatches.reduce((s, d) => {
      const fromLegs = (d.legs ?? []).reduce((ss, l) => ss + (l.perDiem ?? 0), 0)
      return s + (fromLegs > 0 ? fromLegs : (d.perDiem ?? 0))
    }, 0)

    // Fuel split — from FuelRecord station field only
    // Internal = ถังโรงงาน (deducted from factory stock)
    // External = ปั๊มภายนอก / PTT / Shell / Bangchak / Esso / etc.
    const myFuelLogs = fuel.filter(f => f.vehicleId === v.id && ymKey(f.date) === ym)
    const fuelIn = myFuelLogs
      .filter(f => isFactoryStation(f.station))
      .reduce((s, f) => s + (f.total ?? 0), 0)
    const fuelOut = myFuelLogs
      .filter(f => !isFactoryStation(f.station))
      .reduce((s, f) => s + (f.total ?? 0), 0)

    // ค่าใช้จ่าย = maintenance + misc expenses
    const maintTotal = maint
      .filter(m => m.vehicleId === v.id && ymKey(m.startDate) === ym)
      .reduce((s, m) => s + (m.cost ?? 0), 0)
    const expTotal = expenses
      .filter(x => x.vehicleId === v.id && ymKey(x.date) === ym)
      .reduce((s, x) => s + (x.amount ?? 0), 0)

    // Driver salary — split equally among assigned vehicles
    const driver = v.driverId ? employees.find(e => e.id === v.driverId) : undefined
    const driverName = driver?.name ?? '—'
    const salary = driver && driverVehicleCount[driver.id]
      ? (driver.salary ?? 0) / driverVehicleCount[driver.id]
      : 0

    // ดอกเบี้ย — only FixedCost with category === 'ดอกเบี้ย' for this vehicle
    const interest = fixedCosts
      .filter(f => f.vehicleId === v.id && f.category === 'ดอกเบี้ย')
      .reduce((s, f) => s + (f.monthly ?? 0), 0)

    const totalCost = fuelIn + fuelOut + allowance + salary + maintTotal + expTotal + interest
    return {
      v, driverName, rev, fuelIn, fuelOut, allowance, salary,
      expense: maintTotal + expTotal,
      interest, totalCost,
      profit: rev - totalCost,
    }
  })
}

/* ─────────────────────────────────── zero-object helper ── */

const ZERO_TOTALS = {
  rev: 0, fuelIn: 0, fuelOut: 0, allowance: 0,
  salary: 0, expense: 0, interest: 0, totalCost: 0, profit: 0,
}
type Totals = typeof ZERO_TOTALS

function sumRows(rs: VehicleRow[]): Totals {
  return rs.reduce(
    (acc, r) => ({
      rev: acc.rev + r.rev,
      fuelIn: acc.fuelIn + r.fuelIn,
      fuelOut: acc.fuelOut + r.fuelOut,
      allowance: acc.allowance + r.allowance,
      salary: acc.salary + r.salary,
      expense: acc.expense + r.expense,
      interest: acc.interest + r.interest,
      totalCost: acc.totalCost + r.totalCost,
      profit: acc.profit + r.profit,
    }),
    { ...ZERO_TOTALS },
  )
}

/* ──────────────────────────────────────────── MetricCard ── */

function MetricCard({ label, value, tone, icon, subtitle }: {
  label: string; value: string; tone: 'green' | 'red' | 'blue'; icon: string; subtitle?: string
}) {
  const color = tone === 'green' ? '#10B981' : tone === 'red' ? '#EF4444' : 'var(--primary)'
  const bg = tone === 'green' ? '#DCFCE7' : tone === 'red' ? '#FEE2E2' : '#EFF6FF'
  return (
    <div className="card" style={{ padding: '18px 20px', background: '#ffffff' }}>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
          <div className="mono" style={{ fontSize: 21, fontWeight: 700, color, letterSpacing: '-.01em' }}>
            {value}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>บาท</span>
          </div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</div>}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────── InterestCell ── */

function InterestCell({ vehicleId, plate, value, onSaved }: {
  vehicleId: string; plate: string; value: number; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setInput(value > 0 ? String(value) : '')
      setTimeout(() => ref.current?.select(), 0)
    }
  }, [editing, value])

  const save = () => {
    const monthly = parseFloat(input) || 0
    const allFixed = db.getAll<FixedCost>('fixedCosts')
    const existing = allFixed.find(f => f.vehicleId === vehicleId && f.category === 'ดอกเบี้ย')
    if (existing) {
      db.update<FixedCost>('fixedCosts', existing.id, { monthly })
    } else if (monthly > 0) {
      db.add<Partial<FixedCost>>('fixedCosts', {
        name: `ดอกเบี้ย ${plate}`,
        category: 'ดอกเบี้ย',
        monthly,
        paid: false,
        vehicleId,
      })
    }
    setEditing(false)
    onSaved()
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        onBlur={save}
        style={{
          width: 90, textAlign: 'right', padding: '3px 8px',
          borderRadius: 6, border: '1px solid var(--primary)',
          fontSize: 12, fontFamily: 'var(--mono)',
        }}
        placeholder="0"
      />
    )
  }

  return (
    <div
      className="row"
      style={{ gap: 4, justifyContent: 'flex-end', cursor: 'pointer' }}
      onClick={() => setEditing(true)}
      title="คลิกเพื่อแก้ไขดอกเบี้ยรายคัน"
    >
      <span className="mono">{fmt2(value)}</span>
      <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
        <Icon name="edit" size={11} />
      </span>
    </div>
  )
}

/* ──────────────────────────────────────── VehiclePicker ── */

function VehiclePicker({ vehicles, picked, onChange }: {
  vehicles: Vehicle[]
  picked: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [search, setSearch] = useState('')
  const visible = vehicles.filter(v =>
    !search || v.plate.toLowerCase().includes(search.toLowerCase()),
  )
  const allChecked = vehicles.every(v => picked.has(v.id))

  const toggle = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }

  const selectAll = () => onChange(new Set(vehicles.map(v => v.id)))
  const clearAll = () => onChange(new Set())

  return (
    <div
      className="card pl-sidebar"
      style={{ width: 228, flexShrink: 0, display: 'flex', flexDirection: 'column', height: 'fit-content' }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>เลือกรถ</span>
          <span className="badge blue" style={{ marginLeft: 'auto', fontSize: 11 }}>
            {picked.size}/{vehicles.length} คัน
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Icon name="search" size={13} />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาทะเบียน..."
            style={{
              width: '100%', padding: '5px 8px 5px 28px',
              border: '1px solid #CBD5E1', borderRadius: 6,
              fontSize: 12.5, background: 'var(--bg)',
            }}
          />
        </div>
      </div>

      {/* Select all row */}
      <label
        className="row"
        style={{ gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--line)', cursor: 'pointer', fontSize: 12.5 }}
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={e => e.target.checked ? selectAll() : clearAll()}
          style={{ accentColor: 'var(--primary)' }}
        />
        <span style={{ fontWeight: 600 }}>เลือกทั้งหมด</span>
      </label>

      {/* Vehicle list */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
        {visible.map(v => (
          <label
            key={v.id}
            className="row"
            style={{
              gap: 8, padding: '8px 14px', cursor: 'pointer',
              borderBottom: '1px solid var(--line)', fontSize: 12.5,
              background: picked.has(v.id) ? 'var(--primary-50, #EFF6FF)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={picked.has(v.id)}
              onChange={() => toggle(v.id)}
              style={{ accentColor: 'var(--primary)' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontWeight: 600, fontSize: 12 }}>{v.plate}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{v.type}</div>
            </div>
          </label>
        ))}
        {visible.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            ไม่พบทะเบียน
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="row" style={{ padding: '10px 14px', gap: 8, borderTop: '1px solid var(--line)' }}>
        <button className="btn sm" style={{ flex: 1 }} onClick={selectAll}>ทั้งหมด</button>
        <button className="btn sm" style={{ flex: 1 }} onClick={clearAll}>ล้าง</button>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────── Main page ── */

export function FinancePL() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [tick, setTick] = useState(0)

  // Vehicle picker
  const allVehicles = useMemo(() => db.getAll<Vehicle>('vehicles'), [tick])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(db.getAll<Vehicle>('vehicles').map(v => v.id)))

  const ym = `${year}-${String(month + 1).padStart(2, '0')}`

  const yearOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => 2025 + i), [])

  const { allRows } = useMemo(() => {
    try {
      const vehicles = db.getAll<Vehicle>('vehicles')
      const dispatches = db.getAll<Dispatch>('dispatch')
      const fuel = db.getAll<FuelRecord>('fuel')
      const maint = db.getAll<Maintenance>('maintenance')
      const expenses = db.getAll<Expense>('expenses')
      const fixedCosts = db.getAll<FixedCost>('fixedCosts')
      const employees = db.getAll<Employee>('employees')
      const rows = computeRows(vehicles, dispatches, fuel, maint, expenses, fixedCosts, employees, ym)
      return { allRows: rows }
    } catch (err) {
      console.error('FinancePL aggregation failed', err)
      return { allRows: [] }
    }
  }, [ym, tick])

  // Filter by picked vehicles
  const rows = useMemo(
    () => allRows.filter(r => picked.has(r.v.id)),
    [allRows, picked],
  )

  const totals = useMemo(() => sumRows(rows), [rows])
  const isProfit = totals.profit >= 0

  const inputStyle: React.CSSProperties = {
    borderRadius: 6, border: '1px solid #CBD5E1',
    padding: '7px 12px', fontSize: 13, background: '#ffffff',
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">P&amp;L รายคัน</h1>
          <div className="page-sub">
            กำไร-ขาดทุนรายคัน · {thaiMonthLabel(year, month)} ·{' '}
            <span className="mono">{picked.size}/{allVehicles.length} คัน</span>
          </div>
        </div>
      </div>

      {/* ── Summary metrics ── */}
      <div
        className="no-print"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}
      >
        <MetricCard
          label="รายรับรวม"
          value={fmt2(totals.rev)}
          tone="blue"
          icon="money"
          subtitle={`${rows.filter(r => r.rev > 0).length} คันที่มีรายการ`}
        />
        <MetricCard
          label="รายจ่ายรวม"
          value={fmt2(totals.totalCost)}
          tone="red"
          icon="wallet"
          subtitle="น้ำมัน + เบี้ยเลี้ยง + เงินเดือน + ค่าใช้จ่าย + ดอกเบี้ย"
        />
        <MetricCard
          label={isProfit ? 'กำไรสุทธิรวม' : 'ขาดทุนสุทธิรวม'}
          value={fmt2(totals.profit)}
          tone={isProfit ? 'green' : 'red'}
          icon="chart"
          subtitle={totals.rev > 0 ? `Margin ${((totals.profit / totals.rev) * 100).toFixed(1)}%` : 'ยังไม่มีรายรับ'}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="card no-print" style={{ padding: '12px 16px', marginBottom: 16, background: '#ffffff' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>เดือน</span>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              style={{ ...inputStyle, minWidth: 140 }}
            >
              {THAI_MONTHS_FULL.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ปี</span>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              style={{ ...inputStyle, minWidth: 110 }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </div>
          <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
            <button className="btn" onClick={() => window.print()}>
              <Icon name="download" size={14} /> พิมพ์ทั้งหมด ({picked.size} คัน)
            </button>
          </div>
        </div>
      </div>

      {/* ── Print header ── */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>
          รายงาน P&amp;L รายคัน — {thaiMonthLabel(year, month)}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 4 }}>
          KPS Transportation ERP · พิมพ์เมื่อ {db.thaiDate(new Date().toISOString())} · {picked.size} คัน
        </div>
      </div>

      {/* ── Main content: sidebar + table ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Vehicle picker */}
        <VehiclePicker vehicles={allVehicles} picked={picked} onChange={setPicked} />

        {/* P&L table */}
        <div className="card print-area" style={{ flex: 1, minWidth: 0, background: '#ffffff' }}>
          <div className="head no-print" style={{ paddingBottom: 0 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="chart" size={16} />
              ตาราง P&amp;L รายคัน
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                ({rows.length} คัน)
              </span>
            </h3>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="edit" size={11} /> คลิก "ดอกเบี้ย" เพื่อกรอก
            </div>
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              {picked.size === 0 ? 'กรุณาเลือกรถจากแผงด้านซ้าย' : `ไม่พบข้อมูลในเดือน ${thaiMonthLabel(year, month)}`}
            </div>
          ) : (
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ทะเบียนรถ</th>
                    <th className="num right" style={{ whiteSpace: 'nowrap' }}>รายรับ</th>
                    <th className="num right" style={{ whiteSpace: 'nowrap', color: '#0369A1' }}>น้ำมันในโรงงาน</th>
                    <th className="num right" style={{ whiteSpace: 'nowrap', color: '#0369A1' }}>น้ำมันนอก</th>
                    <th className="num right" style={{ whiteSpace: 'nowrap' }}>เบี้ยเลี้ยง</th>
                    <th className="num right" style={{ whiteSpace: 'nowrap' }}>เงินเดือนคนขับ</th>
                    <th className="num right" style={{ whiteSpace: 'nowrap' }}>ค่าใช้จ่าย</th>
                    <th className="num right" style={{ whiteSpace: 'nowrap', color: '#B45309' }}>ดอกเบี้ย</th>
                    <th className="num right" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>กำไรสุทธิ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const profitColor = r.profit >= 0 ? '#10B981' : '#EF4444'
                    const hasActivity = r.rev > 0 || r.totalCost > 0
                    // In single-vehicle print mode, hide other rows
                    return (
                      <tr
                        key={r.v.id}
                        style={{ opacity: hasActivity ? 1 : 0.5 }}
                      >
                        <td>
                          <div className="mono" style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13 }}>
                            {r.v.plate}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.v.type} · {r.v.brand}
                          </div>
                        </td>
                        <td className="num right mono" style={{ fontWeight: 600 }}>{fmt2(r.rev)}</td>
                        <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(r.fuelIn)}</td>
                        <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(r.fuelOut)}</td>
                        <td className="num right mono">{fmt2(r.allowance)}</td>
                        <td className="num right mono">{fmt2(r.salary)}</td>
                        <td className="num right mono">{fmt2(r.expense)}</td>
                        <td className="num right">
                          <InterestCell
                            vehicleId={r.v.id}
                            plate={r.v.plate}
                            value={r.interest}
                            onSaved={() => setTick(t => t + 1)}
                          />
                        </td>
                        <td className="num right mono" style={{ fontWeight: 700, color: profitColor }}>
                          {fmt2(r.profit)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr style={{ background: 'var(--bg-2, #F1F5F9)', fontWeight: 700 }}>
                    <td>รวมทั้งหมด</td>
                    <td className="num right mono">{fmt2(totals.rev)}</td>
                    <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(totals.fuelIn)}</td>
                    <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(totals.fuelOut)}</td>
                    <td className="num right mono">{fmt2(totals.allowance)}</td>
                    <td className="num right mono">{fmt2(totals.salary)}</td>
                    <td className="num right mono">{fmt2(totals.expense)}</td>
                    <td className="num right mono" style={{ color: '#B45309' }}>{fmt2(totals.interest)}</td>
                    <td className="num right mono" style={{ color: isProfit ? '#10B981' : '#EF4444' }}>
                      {fmt2(totals.profit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Interest entry hint ── */}
      <div className="no-print" style={{
        marginTop: 10, padding: '10px 14px',
        background: '#FFFBEB', border: '1px solid #FDE68A',
        borderRadius: 8, fontSize: 12, color: '#92400E',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon name="alert" size={14} />
        <span>
          <strong>ดอกเบี้ย</strong>: คลิกที่ตัวเลขในตารางเพื่อกรอก/แก้ไขดอกเบี้ยรายคัน
          — บันทึกแยกหมวด ไม่กระทบค่าใช้จ่ายหมวดอื่น
          · ดูรายการทั้งหมดได้ที่ <strong>การเงิน → ค่าใช้จ่ายคงที่</strong>
        </span>
      </div>

      {/* ── Print footer ── */}
      <div className="print-only" style={{ marginTop: 12, fontSize: 10, color: '#666', textAlign: 'center' }}>
        * รายงานนี้สร้างจากข้อมูล Real-time · น้ำมันในโรงงาน = ตัดสต็อกถังโรงงาน · น้ำมันนอก = ปั๊มภายนอก
      </div>
    </div>
  )
}
