import { useState, useMemo, useRef, useEffect } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { useAccountingPeriods, findPeriod } from '../../hooks/useAccountingPeriods'
import { Icon, SearchInput, FontScaleControl } from '../../components/ui'
import { usePrint } from '../../hooks/usePrint'
import type {
  Vehicle, Dispatch, FuelRecord, FuelRound, Maintenance,
  Expense, ExpenseHeader, Employee,
  AccountingPeriod, AccountingPeriodSnapshot,
} from '../../types'

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

function isFactoryStation(station: string): boolean {
  return station === 'ถังโรงงาน'
}

/* ─────────────────────────────────────────────── data model ── */

interface VehicleRow {
  v: Vehicle
  driverName: string
  rev: number
  fuelIn: number
  fuelOut: number
  allowance: number
  salary: number
  expense: number
  interest: number
  totalCost: number
  profit: number
}

function computeRows(
  vehicles: Vehicle[],
  dispatches: Dispatch[],
  fuel: FuelRecord[],
  fuelRounds: FuelRound[],
  maint: Maintenance[],
  expenses: Expense[],
  expenseHeaders: ExpenseHeader[],
  employees: Employee[],
  ym: string,
  periods: AccountingPeriod[],
  snapshots: AccountingPeriodSnapshot[],
): VehicleRow[] {
  const driverVehicleCount: Record<string, number> = {}
  for (const v of vehicles) {
    if (v.driverId) driverVehicleCount[v.driverId] = (driverVehicleCount[v.driverId] ?? 0) + 1
  }

  // Find the accounting period for this ym (if any). Used to:
  //  1. Respect carry-forward (accountingPeriodId overrides depart/date)
  //  2. Read snapshot when CLOSED → revenue/perDiem are final
  const [yStr, mStr] = ym.split('-')
  const targetYear  = Number(yStr)
  const targetMonth = Number(mStr)
  const period = findPeriod(periods, targetYear, targetMonth)
  const periodClosed = period?.status === 'CLOSED'

  // Same filter rule as DispatchVehicleMonthlyReport: closed-only by default
  // + respect accounting period assignment (carry-forward).
  const dispatchInPeriod = (d: Dispatch): boolean => {
    if (d.accountingPeriodId && period && d.accountingPeriodId === period.id) return true
    if (d.accountingPeriodId && period && d.accountingPeriodId !== period.id) return false
    // No explicit period assignment → fall back to depart || date month match.
    const basis = d.depart || d.date
    if (!basis) return false
    return ymKey(basis) === ym
  }

  return vehicles.map(v => {
    const myDispatches = dispatches.filter(d =>
      d.vehicleId === v.id
      && dispatchInPeriod(d)
      // Only count rounds that are properly closed (or legacy 'completed').
      && (d.roundStatus === 'closed' || d.status === 'completed'),
    )
    // Use leg sums (db.roundRevenue) to match DispatchVehicleMonthlyReport.
    // If the period is CLOSED, override with snapshot (locked numbers).
    const snapshot = periodClosed && period
      ? snapshots.find(s => s.periodId === period.id && s.vehicleId === v.id)
      : null
    const rev = snapshot
      ? snapshot.data.revenue
      : myDispatches.reduce((s, d) => s + db.roundRevenue(d), 0)
    const allowance = snapshot
      ? snapshot.data.perDiem
      : myDispatches.reduce((s, d) => s + db.roundPerDiem(d), 0)

    // ใช้ accountingDate (เดือนค่าใช้จ่าย) ถ้ามี — น้ำมันปิดรอบที่เติมข้ามเดือนจะตกเดือนของรอบ
    const myFuelLogs = fuel.filter(f => f.vehicleId === v.id && ymKey(f.accountingDate || f.date) === ym)
    const logIn  = myFuelLogs.filter(f =>  isFactoryStation(f.station)).reduce((s, f) => s + (f.total ?? 0), 0)
    const logOut = myFuelLogs.filter(f => !isFactoryStation(f.station)).reduce((s, f) => s + (f.total ?? 0), 0)

    let roundIn = 0, roundOut = 0
    for (const round of fuelRounds.filter(r => r.vehicleId === v.id)) {
      for (const rf of round.refills) {
        if (ymKey(rf.at) !== ym) continue
        if (rf.type === 'start') roundIn += rf.cost ?? 0
        else roundOut += rf.cost ?? 0
      }
    }

    const fuelIn  = logIn  + roundIn
    const fuelOut = logOut + roundOut

    const maintTotal = maint
      .filter(m => m.vehicleId === v.id && ymKey(m.startDate) === ym)
      .reduce((s, m) => s + (m.cost ?? 0), 0)
    const expTotal = expenseHeaders
      .filter(h => h.vehicleId === v.id && ymKey(h.date) === ym)
      .reduce((s, h) => s + (h.total ?? 0), 0)

    const interest = expenses
      .filter(x => x.vehicleId === v.id && ymKey(x.date) === ym && x.category === 'ดอกเบี้ย')
      .reduce((s, x) => s + (x.amount ?? 0), 0)

    const driver = v.driverId ? employees.find(e => e.id === v.driverId) : undefined
    const driverName = driver?.name ?? '—'
    const salary = driver && driverVehicleCount[driver.id]
      ? (driver.salary ?? 0) / driverVehicleCount[driver.id]
      : 0

    const totalCost = fuelIn + fuelOut + allowance + salary + maintTotal + expTotal + interest
    return {
      v, driverName, rev, fuelIn, fuelOut, allowance, salary,
      expense: maintTotal + expTotal,
      interest, totalCost,
      profit: rev - totalCost,
    }
  })
}

/* ─────────────────────────────────────── zero-object helper ── */

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

function InterestCell({ vehicleId, plate, ym, value, onSaved }: {
  vehicleId: string; plate: string; ym: string; value: number; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const { data: flatExpenses = [] } = useList<Expense>('expenses')
  const insertExpense = useInsert<Expense>('expenses')
  const updateExpense = useUpdate<Expense>('expenses')

  useEffect(() => {
    if (editing) {
      setInput(value > 0 ? String(value) : '')
      setTimeout(() => ref.current?.select(), 0)
    }
  }, [editing, value])

  const save = async () => {
    const amount = parseFloat(input) || 0
    const existing = flatExpenses.find(e =>
      e.vehicleId === vehicleId &&
      ymKey(e.date) === ym &&
      e.category === 'ดอกเบี้ย',
    )
    setEditing(false)
    try {
      if (existing) {
        await updateExpense.mutateAsync({ id: existing.id, patch: { amount } })
      } else if (amount > 0) {
        await insertExpense.mutateAsync({
          code: `INT-${ym}-${vehicleId}`,
          vehicleId,
          category: 'ดอกเบี้ย',
          note: `ดอกเบี้ย ${plate}`,
          amount,
          paidBy: 'company',
          date: `${ym}-01`,
          driverId: null,
          status: 'paid',
        })
      }
      onSaved()
    } catch { /* keep prior value on failure */ }
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
  const matchSearch = (v: Vehicle) => !search || v.plate.toLowerCase().includes(search.toLowerCase())
  const allChecked = vehicles.length > 0 && vehicles.every(v => picked.has(v.id))

  const groups = [
    {
      label: '🚛 ขนส่ง',
      vehicles: vehicles.filter(v => (v.groupKind ?? 'TRANSPORT') === 'TRANSPORT'),
    },
    {
      label: '🏭 โรงงานและเครื่องจักร',
      vehicles: vehicles.filter(v => v.groupKind === 'INTERNAL' || v.groupKind === 'EQUIPMENT'),
    },
  ]

  const toggle = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }

  const selectAll = () => onChange(new Set(vehicles.map(v => v.id)))
  const clearAll = () => onChange(new Set())
  const setMany = (ids: string[], on: boolean) => {
    const next = new Set(picked)
    for (const id of ids) {
      if (on) next.add(id); else next.delete(id)
    }
    onChange(next)
  }

  const renderedGroups = groups.map(g => ({
    ...g,
    visible: g.vehicles.filter(matchSearch),
  }))
  const hasAny = renderedGroups.some(g => g.visible.length > 0)

  return (
    <div
      className="card pl-sidebar"
      style={{ width: 228, flexShrink: 0, display: 'flex', flexDirection: 'column', height: 'fit-content' }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>เลือกรถ</span>
          <span className="badge blue" style={{ marginLeft: 'auto', fontSize: 11 }}>
            {picked.size}/{vehicles.length} คัน
          </span>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาทะเบียน..." width="100%" />
      </div>

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

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
        {!hasAny && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            ไม่พบทะเบียน
          </div>
        )}
        {renderedGroups.map(g => {
          if (g.visible.length === 0) return null
          const groupAllChecked = g.vehicles.length > 0 && g.vehicles.every(v => picked.has(v.id))
          return (
            <div key={g.label}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px',
                  background: '#F8FAFC',
                  borderTop: '1px solid var(--line)',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 11.5, fontWeight: 700, color: '#334155',
                }}
              >
                <input
                  type="checkbox"
                  checked={groupAllChecked}
                  onChange={e => setMany(g.vehicles.map(v => v.id), e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ flex: 1 }}>{g.label}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B' }}>
                  {g.vehicles.filter(v => picked.has(v.id)).length}/{g.vehicles.length}
                </span>
              </div>
              {g.visible.map(v => (
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
            </div>
          )
        })}
      </div>

      <div className="row" style={{ padding: '10px 14px', gap: 8, borderTop: '1px solid var(--line)' }}>
        <button className="btn sm" style={{ flex: 1 }} onClick={selectAll}>ทั้งหมด</button>
        <button className="btn sm" style={{ flex: 1 }} onClick={clearAll}>ล้าง</button>
      </div>
    </div>
  )
}

/* ────────────────────────────── P&L table (shared) ── */

function PLTable({
  rows, totals, ym, viewMode, onInterestSaved,
}: {
  rows: VehicleRow[]
  totals: Totals
  ym: string
  viewMode: 'monthly' | 'yearly'
  onInterestSaved: () => void
}) {
  const isProfit = totals.profit >= 0
  return (
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
            <th className="num right" style={{ whiteSpace: 'nowrap', color: '#6D28D9' }}>สุทธิก่อนหักดอกเบี้ย</th>
            <th className="num right" style={{ whiteSpace: 'nowrap', color: '#B45309' }}>ดอกเบี้ย</th>
            <th className="num right" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>กำไรสุทธิ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const profitColor = r.profit >= 0 ? '#10B981' : '#EF4444'
            const beforeInterest = r.profit + r.interest
            const hasActivity = r.rev > 0 || r.totalCost > 0
            return (
              <tr key={r.v.id} style={{ opacity: hasActivity ? 1 : 0.5 }}>
                <td>
                  <div className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {r.v.plate}
                  </div>
                </td>
                <td className="num right mono" style={{ fontWeight: 600 }}>{fmt2(r.rev)}</td>
                <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(r.fuelIn)}</td>
                <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(r.fuelOut)}</td>
                <td className="num right mono">{fmt2(r.allowance)}</td>
                <td className="num right mono">{fmt2(r.salary)}</td>
                <td className="num right mono">{fmt2(r.expense)}</td>
                <td className="num right mono" style={{ fontWeight: 600, color: beforeInterest >= 0 ? '#6D28D9' : '#EF4444' }}>
                  {fmt2(beforeInterest)}
                </td>
                <td className="num right mono" style={{ color: '#B45309' }}>
                  {viewMode === 'monthly' ? (
                    <InterestCell
                      vehicleId={r.v.id}
                      plate={r.v.plate}
                      ym={ym}
                      value={r.interest}
                      onSaved={onInterestSaved}
                    />
                  ) : (
                    <span className="mono">{fmt2(r.interest)}</span>
                  )}
                </td>
                <td className="num right mono" style={{ fontWeight: 700, color: profitColor }}>
                  {fmt2(r.profit)}
                </td>
              </tr>
            )
          })}
          <tr style={{ background: 'var(--bg-2, #F1F5F9)', fontWeight: 700 }}>
            <td>รวมทั้งหมด</td>
            <td className="num right mono">{fmt2(totals.rev)}</td>
            <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(totals.fuelIn)}</td>
            <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(totals.fuelOut)}</td>
            <td className="num right mono">{fmt2(totals.allowance)}</td>
            <td className="num right mono">{fmt2(totals.salary)}</td>
            <td className="num right mono">{fmt2(totals.expense)}</td>
            <td className="num right mono" style={{ color: (totals.profit + totals.interest) >= 0 ? '#6D28D9' : '#EF4444' }}>
              {fmt2(totals.profit + totals.interest)}
            </td>
            <td className="num right mono" style={{ color: '#B45309' }}>{fmt2(totals.interest)}</td>
            <td className="num right mono" style={{ color: isProfit ? '#10B981' : '#EF4444' }}>
              {fmt2(totals.profit)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* ──────────────────────────────────────────── Main page ── */

type ViewMode = 'monthly' | 'yearly'

export function FinancePL() {
  const { print } = usePrint()
  const today = new Date()
  const [year, setYear]       = useState(today.getFullYear())
  const [month, setMonth]     = useState(today.getMonth())
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [onlyWithData, setOnlyWithData] = useState(true)

  const { data: allVehicles = [] } = useList<Vehicle>('vehicles')
  const { data: dispatches = [] } = useDispatches()
  const { data: fuel = [] } = useList<FuelRecord>('fuel_records')
  const { data: fuelRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { data: maint = [] } = useList<Maintenance>('maintenance')
  const { data: expenses = [] } = useList<Expense>('expenses')
  const { data: expenseHeaders = [] } = useList<ExpenseHeader>('expense_headers')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: periods = [] } = useAccountingPeriods()
  const { data: snapshots = [] } = useList<AccountingPeriodSnapshot>('accounting_period_snapshots')

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const pickedInited = useRef(false)
  useEffect(() => {
    if (!pickedInited.current && allVehicles.length) {
      setPicked(new Set(allVehicles.map(v => v.id)))
      pickedInited.current = true
    }
  }, [allVehicles])

  const ym = `${year}-${String(month + 1).padStart(2, '0')}`
  const yearOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => 2025 + i), [])

  /* ── Data computation ── */
  const { allRows, allYearlyRows, allMonthlyData } = useMemo(() => {
    try {
      const allRows = computeRows(allVehicles, dispatches, fuel, fuelRounds, maint, expenses, expenseHeaders, employees, ym, periods, snapshots)

      // Compute all 12 months for yearly view
      const allMonthlyData = Array.from({ length: 12 }, (_, m) => {
        const mYm = `${year}-${String(m + 1).padStart(2, '0')}`
        return { m, ym: mYm, rows: computeRows(allVehicles, dispatches, fuel, fuelRounds, maint, expenses, expenseHeaders, employees, mYm, periods, snapshots) }
      })

      // Sum per vehicle across 12 months
      const acc: Record<string, VehicleRow> = {}
      for (const { rows } of allMonthlyData) {
        for (const r of rows) {
          if (!acc[r.v.id]) {
            acc[r.v.id] = { ...r }
          } else {
            const a = acc[r.v.id]
            a.rev += r.rev; a.fuelIn += r.fuelIn; a.fuelOut += r.fuelOut
            a.allowance += r.allowance; a.salary += r.salary; a.expense += r.expense
            a.interest += r.interest; a.totalCost += r.totalCost; a.profit += r.profit
          }
        }
      }
      const allYearlyRows = allVehicles.map(v => acc[v.id] ?? {
        v, driverName: '—', rev: 0, fuelIn: 0, fuelOut: 0,
        allowance: 0, salary: 0, expense: 0, interest: 0, totalCost: 0, profit: 0,
      })

      return { allRows, allYearlyRows, allMonthlyData }
    } catch (err) {
      console.error('FinancePL aggregation failed', err)
      return { allRows: [], allYearlyRows: [], allMonthlyData: [] }
    }
  }, [ym, year, allVehicles, dispatches, fuel, fuelRounds, maint, expenses, expenseHeaders, employees, periods, snapshots])

  // Filter by picked vehicles
  const rows        = useMemo(() => allRows.filter(r => picked.has(r.v.id)), [allRows, picked])
  const yearlyRows  = useMemo(() => allYearlyRows.filter(r => picked.has(r.v.id)), [allYearlyRows, picked])

  const monthlyBreakdown = useMemo(
    () => allMonthlyData.map(({ m, ym: mYm, rows: mRows }) => ({
      month: m, ym: mYm,
      totals: sumRows(mRows.filter(r => picked.has(r.v.id))),
    })),
    [allMonthlyData, picked],
  )

  const totals       = useMemo(() => sumRows(rows), [rows])
  const yearlyTotals = useMemo(() => sumRows(yearlyRows), [yearlyRows])

  const activeRowsRaw = viewMode === 'yearly' ? yearlyRows : rows
  // 'มียอด' = the truck actually had revenue / fuel / expense activity this
  // period — not just the baseline driver salary that makes idle trucks show
  // a flat -17,000. Hiding those keeps the table to what matters.
  const hasActivity = (r: VehicleRow) =>
    r.rev !== 0 || r.fuelIn !== 0 || r.fuelOut !== 0 || r.allowance !== 0 || r.expense !== 0 || r.interest !== 0
  const activeRows    = onlyWithData ? activeRowsRaw.filter(hasActivity) : activeRowsRaw
  const activeTotals  = onlyWithData
    ? sumRows(activeRows)
    : (viewMode === 'yearly' ? yearlyTotals : totals)
  const isProfit      = activeTotals.profit >= 0

  const inputStyle: React.CSSProperties = {
    borderRadius: 8, border: '1px solid #CBD5E1',
    padding: '7px 12px', fontSize: 13, background: '#ffffff', height: 38,
  }

  /* ── Mode toggle pill style ── */
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: active ? 600 : 500, transition: 'all 0.15s',
    background: active ? '#ffffff' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
  })

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">P&amp;L รายคัน</h1>
          <div className="page-sub">
            กำไร-ขาดทุนรายคัน ·{' '}
            {viewMode === 'monthly' ? thaiMonthLabel(year, month) : `ปี พ.ศ. ${year + 543}`}
            {' '}· <span className="mono">{picked.size}/{allVehicles.length} คัน</span>
            {viewMode === 'monthly' && (() => {
              const p = findPeriod(periods, year, month + 1)
              if (!p) return null
              if (p.status === 'CLOSED') return (
                <span className="badge green" style={{ fontSize: 11, marginLeft: 8 }}>
                  🔒 ปิดงวดแล้ว · ตัวเลขจาก snapshot
                </span>
              )
              return null
            })()}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div
        className="no-print"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}
      >
        <MetricCard
          label={viewMode === 'yearly' ? `รายรับรวมทั้งปี ${year + 543}` : 'รายรับรวม'}
          value={fmt2(activeTotals.rev)}
          tone="blue"
          icon="money"
          subtitle={`${activeRows.filter(r => r.rev > 0).length} คันที่มีรายการ`}
        />
        <MetricCard
          label={viewMode === 'yearly' ? `รายจ่ายรวมทั้งปี ${year + 543}` : 'รายจ่ายรวม'}
          value={fmt2(activeTotals.totalCost)}
          tone="red"
          icon="wallet"
          subtitle="น้ำมัน + เบี้ยเลี้ยง + เงินเดือน + ค่าใช้จ่าย + ดอกเบี้ย"
        />
        <MetricCard
          label={
            isProfit
              ? (viewMode === 'yearly' ? `กำไรสุทธิปี ${year + 543}` : 'กำไรสุทธิรวม')
              : (viewMode === 'yearly' ? `ขาดทุนสุทธิปี ${year + 543}` : 'ขาดทุนสุทธิรวม')
          }
          value={fmt2(activeTotals.profit)}
          tone={isProfit ? 'green' : 'red'}
          icon="chart"
          subtitle={activeTotals.rev > 0 ? `Margin ${((activeTotals.profit / activeTotals.rev) * 100).toFixed(1)}%` : 'ยังไม่มีรายรับ'}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="card no-print" style={{ padding: '12px 16px', marginBottom: 16, background: '#ffffff' }}>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Mode toggle */}
          <div style={{
            display: 'flex', gap: 0, padding: 3,
            borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC',
          }}>
            <button style={tabBtn(viewMode === 'monthly')} onClick={() => setViewMode('monthly')}>
              ดูรายเดือน
            </button>
            <button style={tabBtn(viewMode === 'yearly')} onClick={() => setViewMode('yearly')}>
              ภาพรวมรายปี
            </button>
          </div>

          <label
            className="row no-print"
            style={{ gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', userSelect: 'none' }}
            title="ซ่อนรถที่ไม่มีรายรับ/น้ำมัน/ค่าใช้จ่ายในงวดนี้"
          >
            <input
              type="checkbox"
              checked={onlyWithData}
              onChange={e => setOnlyWithData(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            แสดงเฉพาะที่มียอด
          </label>

          <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />

          {/* Month picker — monthly mode only */}
          {viewMode === 'monthly' && (
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
          )}

          {/* Year picker */}
          <div className="row" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ปี พ.ศ.</span>
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

          {/* Yearly badge */}
          {viewMode === 'yearly' && (
            <div style={{
              background: '#EFF6FF', color: '#1D4ED8',
              borderRadius: 8, padding: '5px 12px',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.01em',
            }}>
              รายงานสรุปประจำปี พ.ศ. {year + 543}
            </div>
          )}

          <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
            <FontScaleControl />
            <button className="btn" onClick={() => print('landscape')}>
              <Icon name="download" size={14} />
              {viewMode === 'yearly'
                ? `พิมพ์รายปี ${year + 543}`
                : `พิมพ์ทั้งหมด (${picked.size} คัน)`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Print header ── */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>
          {viewMode === 'yearly'
            ? `รายงานสรุปประจำปี พ.ศ. ${year + 543}`
            : `รายงาน P&L รายคัน — ${thaiMonthLabel(year, month)}`}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 4 }}>
          KPS Transportation ERP · พิมพ์เมื่อ {db.thaiDate(new Date().toISOString())} · {picked.size} คัน
        </div>
      </div>

      {/* ── Main content: sidebar + tables ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        <VehiclePicker vehicles={allVehicles} picked={picked} onChange={setPicked} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Main P&L table */}
          <div className="card print-area" style={{ background: '#ffffff' }}>
            <div className="head no-print" style={{ paddingBottom: 0 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="chart" size={16} />
                {viewMode === 'yearly'
                  ? `ตาราง P&L รายปี พ.ศ. ${year + 543}`
                  : 'ตาราง P&L รายคัน'}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                  ({activeRows.length} คัน)
                </span>
              </h3>
              {viewMode === 'monthly' && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="edit" size={11} /> คลิก "ดอกเบี้ย" เพื่อกรอก
                </div>
              )}
            </div>

            {activeRows.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                {picked.size === 0
                  ? 'กรุณาเลือกรถจากแผงด้านซ้าย'
                  : viewMode === 'yearly'
                    ? `ไม่พบข้อมูลในปี พ.ศ. ${year + 543}`
                    : `ไม่พบข้อมูลในเดือน ${thaiMonthLabel(year, month)}`}
              </div>
            ) : (
              <PLTable
                rows={activeRows}
                totals={activeTotals}
                ym={ym}
                viewMode={viewMode}
                onInterestSaved={() => {}}
              />
            )}
          </div>

          {/* Monthly breakdown — yearly mode only */}
          {viewMode === 'yearly' && (
            <div className="card print-area" style={{ background: '#ffffff' }}>
              <div className="head no-print" style={{ paddingBottom: 0 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="chart" size={16} />
                  สรุปรายเดือน — ปี พ.ศ. {year + 543}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                    (ยอดรวมทุกคันที่เลือก)
                  </span>
                </h3>
              </div>

              <div className="print-only" style={{ fontSize: 12, fontWeight: 600, padding: '4px 0 8px' }}>
                สรุปรายเดือน — ปี พ.ศ. {year + 543}
              </div>

              <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>เดือน</th>
                      <th className="num right" style={{ whiteSpace: 'nowrap' }}>รายรับ</th>
                      <th className="num right" style={{ whiteSpace: 'nowrap', color: '#0369A1' }}>น้ำมันในโรงงาน</th>
                      <th className="num right" style={{ whiteSpace: 'nowrap', color: '#0369A1' }}>น้ำมันนอก</th>
                      <th className="num right" style={{ whiteSpace: 'nowrap' }}>รายจ่ายรวม</th>
                      <th className="num right" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>กำไรสุทธิ</th>
                      <th className="num right" style={{ whiteSpace: 'nowrap' }}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyBreakdown.map(({ month: m, ym: mYm, totals: mt }) => {
                      const pColor = mt.profit >= 0 ? '#10B981' : '#EF4444'
                      const hasData = mt.rev > 0 || mt.totalCost > 0
                      return (
                        <tr key={mYm} style={{ opacity: hasData ? 1 : 0.42 }}>
                          <td style={{ fontWeight: 500 }}>{THAI_MONTHS_FULL[m]}</td>
                          <td className="num right mono" style={{ fontWeight: 600 }}>{fmt2(mt.rev)}</td>
                          <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(mt.fuelIn)}</td>
                          <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(mt.fuelOut)}</td>
                          <td className="num right mono" style={{ color: '#EF4444' }}>{fmt2(mt.totalCost)}</td>
                          <td className="num right mono" style={{ fontWeight: 700, color: pColor }}>{fmt2(mt.profit)}</td>
                          <td className="num right mono" style={{ fontSize: 12, color: pColor }}>
                            {mt.rev > 0 ? `${(mt.profit / mt.rev * 100).toFixed(1)}%` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: 'var(--bg-2, #F1F5F9)', fontWeight: 700 }}>
                      <td>รวมทั้งปี {year + 543}</td>
                      <td className="num right mono">{fmt2(yearlyTotals.rev)}</td>
                      <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(yearlyTotals.fuelIn)}</td>
                      <td className="num right mono" style={{ color: '#0369A1' }}>{fmt2(yearlyTotals.fuelOut)}</td>
                      <td className="num right mono" style={{ color: '#EF4444' }}>{fmt2(yearlyTotals.totalCost)}</td>
                      <td className="num right mono" style={{ color: yearlyTotals.profit >= 0 ? '#10B981' : '#EF4444' }}>
                        {fmt2(yearlyTotals.profit)}
                      </td>
                      <td className="num right mono" style={{ fontSize: 12 }}>
                        {yearlyTotals.rev > 0
                          ? `${(yearlyTotals.profit / yearlyTotals.rev * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Contextual hint ── */}
      {viewMode === 'monthly' ? (
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
      ) : (
        <div className="no-print" style={{
          marginTop: 10, padding: '10px 14px',
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 8, fontSize: 12, color: '#1E40AF',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="chart" size={14} />
          <span>
            <strong>ภาพรวมรายปี พ.ศ. {year + 543}</strong>: ตัวเลขสะสมทั้ง 12 เดือน คำนวณ Real-time
            · ดอกเบี้ยในโหมดนี้เป็นแบบอ่านอย่างเดียว — หากต้องการแก้ไขให้เปลี่ยนเป็นโหมดรายเดือน
          </span>
        </div>
      )}

      {/* ── Print footer ── */}
      <div className="print-only" style={{ marginTop: 12, fontSize: 10, color: '#666', textAlign: 'center' }}>
        * รายงานนี้สร้างจากข้อมูล Real-time · น้ำมันในโรงงาน = ตัดสต็อกถังโรงงาน · น้ำมันนอก = ปั๊มภายนอก
      </div>
    </div>
  )
}
