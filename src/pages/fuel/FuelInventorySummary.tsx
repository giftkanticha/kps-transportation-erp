import { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import type { FuelStock, FuelTransaction, Vehicle, Dispatch, User } from '../../types'
import { Icon, Field } from '../../components/ui'

// ─── Predefined suppliers ───────────────────────────────────────────────────
const FUEL_SUPPLIERS = [
  'บริษัท ปตท. น้ำมัน จำกัด',
  'บริษัท บางจาก คอร์ปอเรชั่น จำกัด',
  'บริษัท เชลล์ แห่งประเทศไทย จำกัด',
  'บริษัท เอสโซ่ (ประเทศไทย) จำกัด',
  'อื่นๆ (ระบุในช่องหมายเหตุ)',
]

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const PAGE_SIZE = 20

// ─── Overlay / Modal shell ───────────────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

// ─── Add Stock In Modal ───────────────────────────────────────────────────────
interface AddModalProps { onClose: () => void; onSaved: () => void }

function AddStockModal({ onClose, onSaved }: AddModalProps) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    liters: '',
    pricePerL: '',
    supplier: '',
    invoiceNo: '',
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const total = (Number(form.liters) || 0) * (Number(form.pricePerL) || 0)

  const todayISO = new Date().toISOString().slice(0, 10)
  const isBackdated = form.date < todayISO

  const save = () => {
    if (!form.liters || Number(form.liters) <= 0) return setErr('กรุณาระบุจำนวนลิตร (> 0)')
    if (!form.supplier) return setErr('กรุณาเลือกแหล่งที่มา')
    if (form.date > todayISO) return setErr('วันที่เกิดเหตุไม่สามารถเป็นอนาคตได้')
    setSaving(true)
    db.add<FuelStock>('fuelStock', {
      id: uid('fs'),
      date: form.date,                         // transactionDate
      recordedAt: new Date().toISOString(),    // audit: when entered
      supplier: form.supplier,
      liters: Number(form.liters),
      pricePerL: Number(form.pricePerL) || 0,
      invoiceNo: form.invoiceNo,
      total,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>⛽ เพิ่มน้ำมันเข้าคลัง</h2>
          <button className="btn ghost icon" onClick={onClose} style={{ padding: 4 }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {err && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Audit strip — always visible */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>📝 บันทึกเมื่อ:</span>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--text-1)' }}>
              {new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B' }}>auto-timestamp</span>
          </div>

          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันที่เกิดเหตุ (Transaction Date) *">
              <input type="date" value={form.date} max={todayISO} onChange={e => set('date', e.target.value)} />
              {isBackdated && (
                <div style={{ fontSize: 11, marginTop: 4, color: '#7C3AED', fontWeight: 500 }}>
                  ⬅️ ย้อนหลัง — รายงานจะ filter ตามวันนี้ถูกต้อง
                </div>
              )}
              {!isBackdated && (
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>
                  💡 ใส่ย้อนหลังได้ (เช่น 15/04 ถึงแม้วันนี้ 19/05)
                </div>
              )}
            </Field>
            <Field label="จำนวนลิตร *">
              <input type="number" step="0.01" value={form.liters} onChange={e => set('liters', e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          <Field label="แหล่งน้ำมัน / ผู้จำหน่าย *">
            <select value={form.supplier} onChange={e => set('supplier', e.target.value)}>
              <option value="">-- เลือกผู้จำหน่าย --</option>
              {FUEL_SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="ราคา/ลิตร (บาท)">
              <input type="number" step="0.01" value={form.pricePerL} onChange={e => set('pricePerL', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="เลขใบส่งของ">
              <input value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} placeholder="INV-XXXXXX" />
            </Field>
          </div>

          {total > 0 && (
            <div style={{ background: 'var(--primary-50)', borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>มูลค่ารวม</span>
              <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: 'var(--primary)' }}>{db.thb(total)}</span>
            </div>
          )}
        </div>

        <div className="btn-row" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Full History Modal ───────────────────────────────────────────────────────
interface HistoryModalProps {
  type: 'in' | 'out'
  balanceMap: Record<string, number>
  onClose: () => void
}

function StockHistoryModal({ type, balanceMap, onClose }: HistoryModalProps) {
  const [page, setPage] = useState(1)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterVehicle, setFilterVehicle] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')

  const allFuelStock = db.getAll<FuelStock>('fuelStock')
  const factoryTxs = db.getAll<FuelTransaction>('fuelTransactions')
    .filter(t => t.source === 'FACTORY_TANK' && t.status !== 'REVERSED')
  const vehicles = db.getAll<Vehicle>('vehicles')
  const dispatches = db.getAll<Dispatch>('dispatch')

  const rows = type === 'in'
    ? [...allFuelStock].sort((a, b) => b.date.localeCompare(a.date))
    : [...factoryTxs].sort((a, b) => b.date.localeCompare(a.date))

  const filtered = rows.filter(r => {
    const row = r as FuelStock & FuelTransaction
    if (filterFrom && row.date < filterFrom) return false
    if (filterTo && row.date > filterTo) return false
    if (type === 'in' && filterSupplier) {
      const s = row as FuelStock
      if (!s.supplier?.toLowerCase().includes(filterSupplier.toLowerCase())) return false
    }
    if (type === 'out' && filterVehicle) {
      const t = row as FuelTransaction
      const plate = vehicles.find(v => v.id === t.vehicleId)?.plate ?? ''
      if (!plate.toLowerCase().includes(filterVehicle.toLowerCase())) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetFilters = () => {
    setFilterFrom(''); setFilterTo(''); setFilterVehicle(''); setFilterSupplier(''); setPage(1)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 14, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {type === 'in' ? '📥 ประวัติน้ำมันเข้า (Stock In)' : '📤 ประวัติน้ำมันออก (Stock Out)'}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {filtered.length} รายการ
            </div>
          </div>
          <button className="btn ghost icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
            style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13 }}
            title="วันที่เริ่มต้น"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1) }}
            style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13 }}
            title="วันที่สิ้นสุด"
          />
          {type === 'in' ? (
            <input
              value={filterSupplier}
              onChange={e => { setFilterSupplier(e.target.value); setPage(1) }}
              placeholder="ค้นหาผู้จำหน่าย"
              style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, width: 180 }}
            />
          ) : (
            <input
              value={filterVehicle}
              onChange={e => { setFilterVehicle(e.target.value); setPage(1) }}
              placeholder="ค้นหาทะเบียนรถ"
              style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, width: 180 }}
            />
          )}
          {(filterFrom || filterTo || filterVehicle || filterSupplier) && (
            <button className="btn sm" onClick={resetFilters}>รีเซ็ต</button>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>วันที่เกิดเหตุ</th>
                <th className="num right">ลิตร</th>
                {type === 'in' ? (
                  <>
                    <th>ผู้จำหน่าย</th>
                    <th className="num right">ราคา/ลิตร</th>
                    <th className="num right">มูลค่า</th>
                    <th>เลขใบส่งของ</th>
                    <th>บันทึกเมื่อ</th>
                  </>
                ) : (
                  <>
                    <th>ทะเบียนรถ</th>
                    <th>รอบงาน</th>
                    <th>ประเภท</th>
                    <th>บันทึกเมื่อ</th>
                  </>
                )}
                <th className="num right">ยอดสะสม</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={type === 'in' ? 8 : 7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>ไม่พบข้อมูล</td></tr>
              ) : paginated.map(r => {
                const balance = balanceMap[(r as { id: string }).id]
                if (type === 'in') {
                  const s = r as FuelStock
                  const recDateISO = s.recordedAt ? s.recordedAt.slice(0, 10) : null
                  const backdated = recDateISO && recDateISO > s.date
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="mono" style={{ fontSize: 12.5 }}>{db.thaiDate(s.date)}</div>
                        {backdated && (
                          <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>⬅️ ย้อนหลัง</div>
                        )}
                      </td>
                      <td className="num right mono" style={{ color: 'var(--green)', fontWeight: 600 }}>+{db.fmt(s.liters)}</td>
                      <td style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.supplier}</td>
                      <td className="num right mono muted">{s.pricePerL ? `${s.pricePerL.toFixed(2)}` : '—'}</td>
                      <td className="num right mono">{s.total ? db.thb(s.total) : '—'}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{s.invoiceNo || '—'}</td>
                      <td className="muted" style={{ fontSize: 11 }}>
                        {s.recordedAt
                          ? new Date(s.recordedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="num right mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{balance != null ? db.fmt(balance) : '—'}</td>
                    </tr>
                  )
                } else {
                  const t = r as FuelTransaction
                  const plate = vehicles.find(v => v.id === t.vehicleId)?.plate ?? '—'
                  const tripCode = dispatches.find(d => d.id === t.tripId)?.code ?? (t.tripId ? t.tripId.slice(0, 8) : '—')
                  const txDateISO = t.date
                  const recDateISO = t.createdAt ? t.createdAt.slice(0, 10) : null
                  const backdated = recDateISO && recDateISO > txDateISO
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="mono" style={{ fontSize: 12.5 }}>{db.thaiDate(t.date)}</div>
                        {backdated && (
                          <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>⬅️ ย้อนหลัง</div>
                        )}
                      </td>
                      <td className="num right mono" style={{ color: '#DC2626', fontWeight: 600 }}>−{db.fmt(t.liters)}</td>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{plate}</td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{tripCode}</td>
                      <td>
                        <span className="badge" style={{ fontSize: 10.5 }}>
                          {t.tripFuelRole === 'TRIP_OPENING' ? 'ต้นรอบ'
                            : t.tripFuelRole === 'TRIP_CLOSING' ? 'ปลายรอบ'
                            : t.tripFuelRole === 'INTERMEDIATE' ? 'กลางทาง'
                            : 'ทั่วไป'}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 11 }}>
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="num right mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{balance != null ? db.fmt(balance) : '—'}</td>
                    </tr>
                  )
                }
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            หน้า {page} / {totalPages} · {filtered.length} รายการ
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ← ก่อนหน้า
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return (
                <button
                  key={pg}
                  className="btn sm"
                  style={{ background: pg === page ? 'var(--primary)' : 'transparent', color: pg === page ? '#fff' : 'var(--text-2)', minWidth: 32 }}
                  onClick={() => setPage(pg)}
                >
                  {pg}
                </button>
              )
            })}
            <button className="btn sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              ถัดไป →
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color, sub }: {
  label: string; value: string; unit?: string; color?: string; sub?: string
}) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: color || 'var(--text-1)' }}>
        {value} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}

// ─── Monthly report helpers ───────────────────────────────────────────────────
function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}
function isoDate(year: number, month1to12: number, day: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
const isFactoryStation = (station: string) =>
  !['PTT', 'Shell', 'Bangchak', 'Esso'].some(s => station?.includes(s))

// ─── Main Component ───────────────────────────────────────────────────────────
export function FuelInventorySummary() {
  const [tick, setTick] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [historyType, setHistoryType] = useState<'in' | 'out' | null>(null)

  // Monthly report state
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  const user = db.currentUser() as User | null
  const canAdd = user?.role !== 'driver'
  const canDelete = user?.role === 'admin'

  const allFuelStock = useMemo(() => db.getAll<FuelStock>('fuelStock'), [tick])
  const factoryTxs = useMemo(
    () => db.getAll<FuelTransaction>('fuelTransactions')
      .filter(t => t.source === 'FACTORY_TANK' && t.status !== 'REVERSED'),
    [tick],
  )
  const vehicles = useMemo(() => db.getAll<Vehicle>('vehicles'), [])
  const dispatches = useMemo(() => db.getAll<Dispatch>('dispatch'), [])

  // Running balance per record (merged sorted events)
  const balanceMap = useMemo<Record<string, number>>(() => {
    const events = [
      ...allFuelStock.map(s => ({ date: s.date, id: s.id, liters: s.liters, type: 'in' as const })),
      ...factoryTxs.map(t => ({ date: t.date, id: t.id, liters: t.liters, type: 'out' as const })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    let bal = 0
    const map: Record<string, number> = {}
    for (const e of events) {
      bal += e.type === 'in' ? e.liters : -e.liters
      map[e.id] = bal
    }
    return map
  }, [allFuelStock, factoryTxs])

  // Dashboard KPIs
  const currentBalance = allFuelStock.reduce((s, r) => s + r.liters, 0) - factoryTxs.reduce((s, t) => s + t.liters, 0)
  const todayISO = today.toISOString().slice(0, 10)
  const todayIn = allFuelStock.filter(s => s.date === todayISO).reduce((s, r) => s + r.liters, 0)
  const todayOut = factoryTxs.filter(t => t.date === todayISO).reduce((s, t) => s + t.liters, 0)
  const totalStockValue = allFuelStock.reduce((s, r) => s + r.total, 0)
  const avgPrice = allFuelStock.reduce((s, r) => s + r.liters, 0) > 0
    ? totalStockValue / allFuelStock.reduce((s, r) => s + r.liters, 0)
    : 0

  // Recent lists
  const recentIn = useMemo(
    () => [...allFuelStock].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [allFuelStock],
  )
  const recentOut = useMemo(
    () => [...factoryTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [factoryTxs],
  )

  const handleSaved = () => { setShowAddModal(false); setTick(t => t + 1) }

  const deleteStockIn = (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    db.remove('fuelStock', id)
    setTick(t => t + 1)
  }

  // Monthly report
  const allFuelRecord = useMemo(() => db.getAll<{ id: string; date: string; liters: number; station: string }>('fuel'), [tick])
  const factoryFuelings = useMemo(
    () => allFuelRecord.filter(f => isFactoryStation(f.station)),
    [allFuelRecord],
  )
  const days = daysInMonth(year, month)
  const monthStartISO = isoDate(year, month, 1)

  const dailyRows = useMemo(() => {
    const carryIn = allFuelStock.filter(s => s.date < monthStartISO).reduce((sum, s) => sum + s.liters, 0)
    const carryOut = factoryFuelings.filter(f => f.date < monthStartISO).reduce((sum, f) => sum + f.liters, 0)
    let balance = carryIn - carryOut
    const rows = []
    for (let d = 1; d <= days; d++) {
      const iso = isoDate(year, month, d)
      const dayIn = allFuelStock.filter(s => s.date === iso).reduce((sum, s) => sum + s.liters, 0)
      const dayOut = factoryFuelings.filter(f => f.date === iso).reduce((sum, f) => sum + f.liters, 0)
      const brought = balance
      balance = brought + dayIn - dayOut
      rows.push({ day: d, date: `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`, brought, in: dayIn, out: dayOut, balance })
    }
    return rows
  }, [allFuelStock, factoryFuelings, year, month, days, monthStartISO])

  const monthTotals = useMemo(() => {
    return {
      totalIn: dailyRows.reduce((s, r) => s + r.in, 0),
      totalOut: dailyRows.reduce((s, r) => s + r.out, 0),
      opening: dailyRows[0]?.brought ?? 0,
      closing: dailyRows[dailyRows.length - 1]?.balance ?? 0,
    }
  }, [dailyRows])

  return (
    <div>
      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุปคลังน้ำมันโรงงาน</h1>
          <div className="page-sub">Dashboard · ประวัติการเข้า-ออก · รายงานรายเดือน</div>
        </div>
        <div className="actions">
          {canAdd && (
            <button className="btn primary" onClick={() => setShowAddModal(true)}>
              <Icon name="plus" size={15} /> เพิ่มน้ำมันเข้าคลัง
            </button>
          )}
          <button className="btn" onClick={() => window.print()}>
            <Icon name="download" size={15} /> พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid-4 no-print" style={{ marginBottom: 20, gap: 14 }}>
        <StatCard
          label="⛽ ยอดคลังปัจจุบัน"
          value={db.fmt(Math.max(0, currentBalance))}
          unit="ลิตร"
          color={currentBalance < 100 ? 'var(--red)' : 'var(--green)'}
          sub={`ราคาเฉลี่ย ${avgPrice.toFixed(2)} บาท/ลิตร`}
        />
        <StatCard
          label="📥 เข้าวันนี้"
          value={db.fmt(todayIn)}
          unit="ลิตร"
          color={todayIn > 0 ? '#166534' : 'var(--text-muted)'}
        />
        <StatCard
          label="📤 ออกวันนี้ (ถังโรงงาน)"
          value={db.fmt(todayOut)}
          unit="ลิตร"
          color={todayOut > 0 ? '#A32D2D' : 'var(--text-muted)'}
        />
        <StatCard
          label="📦 รับเข้าทั้งหมด"
          value={db.fmt(allFuelStock.reduce((s, r) => s + r.liters, 0))}
          unit="ลิตร"
          sub={`${allFuelStock.length} รายการ · ${db.thb(totalStockValue)}`}
        />
      </div>

      {/* ─── Stock In Recent ──────────────────────────────────────────────── */}
      <div className="card no-print" style={{ marginBottom: 18 }}>
        <div className="head">
          <SectionHead
            title="📥 ประวัติน้ำมันเข้าคลัง (Stock In) — 5 รายการล่าสุด"
            sub={`รวมทั้งหมด ${allFuelStock.length} รายการ`}
            action={
              <button className="btn sm outline" onClick={() => setHistoryType('in')}>
                📂 ดูประวัติเข้าทั้งหมด
              </button>
            }
          />
        </div>
        {recentIn.length === 0 ? (
          <div className="empty" style={{ padding: 32 }}>ยังไม่มีรายการน้ำมันเข้า</div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่เกิดเหตุ</th>
                  <th>ผู้จำหน่าย</th>
                  <th className="right">ลิตร</th>
                  <th className="right">ราคา/ลิตร</th>
                  <th className="right">มูลค่า</th>
                  <th>เลขใบส่งของ</th>
                  <th>บันทึกเมื่อ</th>
                  <th className="right">ยอดสะสม</th>
                  {canDelete && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {recentIn.map(s => {
                  const recDateISO = s.recordedAt ? s.recordedAt.slice(0, 10) : null
                  const backdated = recDateISO && recDateISO > s.date
                  return (
                  <tr key={s.id}>
                    <td>
                      <div className="mono" style={{ fontSize: 12.5 }}>{db.thaiDate(s.date)}</div>
                      {backdated && (
                        <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>⬅️ ย้อนหลัง</div>
                      )}
                    </td>
                    <td style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.supplier}
                    </td>
                    <td className="num right mono" style={{ color: '#166534', fontWeight: 600 }}>+{db.fmt(s.liters)}</td>
                    <td className="num right muted" style={{ fontSize: 12 }}>{s.pricePerL ? `${s.pricePerL.toFixed(2)}` : '—'}</td>
                    <td className="num right mono">{s.total ? db.thb(s.total) : '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{s.invoiceNo || '—'}</td>
                    <td className="muted" style={{ fontSize: 11 }}>
                      {s.recordedAt
                        ? new Date(s.recordedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="num right mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {balanceMap[s.id] != null ? db.fmt(balanceMap[s.id]) : '—'}
                    </td>
                    {canDelete && (
                      <td>
                        <button
                          className="btn ghost icon sm"
                          style={{ color: 'var(--red)' }}
                          onClick={() => deleteStockIn(s.id)}
                          title="ลบรายการ"
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Stock Out Recent ─────────────────────────────────────────────── */}
      <div className="card no-print" style={{ marginBottom: 28 }}>
        <div className="head">
          <SectionHead
            title="📤 ประวัติน้ำมันออกคลัง (Stock Out) — 10 รายการล่าสุด"
            sub="เฉพาะการเติมจากถังโรงงาน"
            action={
              <button className="btn sm outline" onClick={() => setHistoryType('out')}>
                📂 ดูประวัติออกทั้งหมด
              </button>
            }
          />
        </div>
        {recentOut.length === 0 ? (
          <div className="empty" style={{ padding: 32 }}>ยังไม่มีรายการน้ำมันออก</div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ทะเบียนรถ</th>
                  <th>รอบงาน</th>
                  <th className="right">ลิตร</th>
                  <th>บทบาท</th>
                  <th className="right">ยอดสะสม</th>
                </tr>
              </thead>
              <tbody>
                {recentOut.map(t => {
                  const plate = vehicles.find(v => v.id === t.vehicleId)?.plate ?? '—'
                  const trip = dispatches.find(d => d.id === t.tripId)
                  return (
                    <tr key={t.id}>
                      <td className="mono muted">{db.thaiDate(t.date)}</td>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{plate}</td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{trip?.code ?? (t.tripId ? '…' : '—')}</td>
                      <td className="num right mono" style={{ color: '#A32D2D', fontWeight: 600 }}>−{db.fmt(t.liters)}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            fontSize: 10.5,
                            background:
                              t.tripFuelRole === 'TRIP_OPENING' ? '#EFF6FF' :
                              t.tripFuelRole === 'TRIP_CLOSING' ? '#F0FDF4' :
                              t.tripFuelRole === 'INTERMEDIATE' ? '#FFF7ED' : 'var(--bg)',
                            color:
                              t.tripFuelRole === 'TRIP_OPENING' ? '#1D4ED8' :
                              t.tripFuelRole === 'TRIP_CLOSING' ? '#166534' :
                              t.tripFuelRole === 'INTERMEDIATE' ? '#C2410C' : 'var(--text-2)',
                          }}
                        >
                          {t.tripFuelRole === 'TRIP_OPENING' ? '🔵 ต้นรอบ'
                            : t.tripFuelRole === 'TRIP_CLOSING' ? '🟢 ปลายรอบ'
                            : t.tripFuelRole === 'INTERMEDIATE' ? '🟠 กลางทาง'
                            : '⚪ ทั่วไป'}
                        </span>
                      </td>
                      <td className="num right mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {balanceMap[t.id] != null ? db.fmt(balanceMap[t.id]) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Monthly Report (printable) ───────────────────────────────────── */}
      <div className="print-area">
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

        <div className="grid-4 no-print" style={{ marginBottom: 18, gap: 14 }}>
          <div className="card kpi">
            <div className="label">ยอดเปิดเดือน</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{db.fmt(monthTotals.opening)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span></div>
          </div>
          <div className="card kpi">
            <div className="label">น้ำมันเข้ารวม</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: '#166534' }}>+{db.fmt(monthTotals.totalIn)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span></div>
          </div>
          <div className="card kpi">
            <div className="label">น้ำมันออกรวม</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: '#A32D2D' }}>−{db.fmt(monthTotals.totalOut)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span></div>
          </div>
          <div className="card kpi">
            <div className="label">คงเหลือสิ้นเดือน</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: 'var(--primary)' }}>{db.fmt(monthTotals.closing)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span></div>
          </div>
        </div>

        <div className="print-only" style={{ textAlign: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #000' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>รายงานสรุปคลังน้ำมันโรงงาน</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{THAI_MONTHS_FULL[month - 1]} พ.ศ. {year + 543}</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="head"><h3>สรุปน้ำมันคลังโรงงานรายวัน — {THAI_MONTHS_FULL[month - 1]} {year + 543}</h3></div>
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
                    <td className="num right mono" style={{ color: r.in > 0 ? '#166534' : 'var(--text-muted)' }}>{r.in > 0 ? `+${db.fmt(r.in)}` : '—'}</td>
                    <td className="num right mono" style={{ color: r.out > 0 ? '#A32D2D' : 'var(--text-muted)' }}>{r.out > 0 ? `−${db.fmt(r.out)}` : '—'}</td>
                    <td className="num right mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{db.fmt(r.balance)}</td>
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

        <div className="print-only" style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>ผู้จัดทำ</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>(.....................................)</div>
            <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>ผู้อนุมัติ</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>(.....................................)</div>
            <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
          </div>
        </div>
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────── */}
      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} onSaved={handleSaved} />}
      {historyType && (
        <StockHistoryModal
          type={historyType}
          balanceMap={balanceMap}
          onClose={() => setHistoryType(null)}
        />
      )}
    </div>
  )
}
