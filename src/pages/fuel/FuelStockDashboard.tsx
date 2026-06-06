import { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { useAuth } from '../../context/AuthContext'
import type { FuelStock, FuelTransaction, Vehicle, Partner, ExpenseHeader, ExpenseLine } from '../../types'
import { Icon, Field, PrintButton, FontScaleControl } from '../../components/ui'

const FUEL_PARTNER_TYPE = 'ซัพพลายเออร์น้ำมัน'
const PAGE_SIZE = 20

// EXP-YYYYMMDD-NNN code generator, mirrored from ExpensesModule so fuel
// auto-expenses share the same numbering scheme as manually entered ones.
function genExpCode(headers: ExpenseHeader[]): string {
  const now = new Date()
  const yyyymmdd =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const prefix = `EXP-${yyyymmdd}-`
  const existing = headers.filter(h => h.code?.startsWith(prefix))
  const maxSeq = existing.reduce((max, h) => {
    const n = parseInt(h.code.slice(prefix.length), 10)
    return Number.isNaN(n) ? max : Math.max(max, n)
  }, 0)
  return prefix + String(maxSeq + 1).padStart(3, '0')
}

// Next FUEL-NNN partner code based on whatever's already in the partners table.
function nextFuelPartnerCode(partners: Partner[]): string {
  const maxN = partners
    .filter(p => p.code?.startsWith('FUEL-'))
    .reduce((max, p) => {
      const n = parseInt(p.code.slice(5), 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
  return 'FUEL-' + String(maxN + 1).padStart(3, '0')
}

// ─── Modal overlay ────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose, className }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <div
      className={className}
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
  const todayISO = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: todayISO,
    liters: '',
    pricePerL: '',
    supplierId: '',       // partner.id, or '__new__' to create
    newSupplierName: '',  // used when supplierId === '__new__'
    invoiceNo: '',
    recordExpense: true,  // checkbox — auto-create expense_header alongside the stock entry
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: partners = [] } = useList<Partner>('partners')
  const { data: expenseHeaders = [] } = useList<ExpenseHeader>('expense_headers')
  const insertStock        = useInsert<FuelStock>('fuel_stock')
  const insertPartner      = useInsert<Partner>('partners')
  const insertExpenseHdr   = useInsert<ExpenseHeader>('expense_headers')
  const insertExpenseLine  = useInsert<ExpenseLine>('expense_lines')

  const fuelSuppliers = useMemo(
    () => partners.filter(p => p.type === FUEL_PARTNER_TYPE && p.status === 'active'),
    [partners],
  )

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))
  const total = (Number(form.liters) || 0) * (Number(form.pricePerL) || 0)
  const isBackdated = form.date < todayISO
  const isNewSupplier = form.supplierId === '__new__'
  const canRecordExpense = total > 0  // need a price to book AP

  const save = async () => {
    if (!form.liters || Number(form.liters) <= 0) return setErr('กรุณาระบุจำนวนลิตร (> 0)')
    if (!form.supplierId)                          return setErr('กรุณาเลือกผู้จำหน่าย')
    if (isNewSupplier && !form.newSupplierName.trim())
                                                    return setErr('กรุณากรอกชื่อผู้จำหน่ายใหม่')
    if (form.date > todayISO)                       return setErr('วันที่เกิดเหตุไม่สามารถเป็นอนาคตได้')

    setSaving(true)
    try {
      // 1) Resolve partner — create a new one inline if requested.
      let partnerId = form.supplierId
      let partnerName = ''
      if (isNewSupplier) {
        const created = await insertPartner.mutateAsync({
          code: nextFuelPartnerCode(partners),
          name: form.newSupplierName.trim(),
          type: FUEL_PARTNER_TYPE,
          status: 'active',
        })
        partnerId = created.id
        partnerName = created.name
      } else {
        partnerName = partners.find(p => p.id === partnerId)?.name ?? ''
      }

      // 2) Optionally book the purchase as an AP expense, linked back to fuel_stock.
      let expenseHeaderId: string | null = null
      if (form.recordExpense && canRecordExpense) {
        const header = await insertExpenseHdr.mutateAsync({
          code: genExpCode(expenseHeaders),
          date: form.date,
          vehicleId: null as unknown as string,  // fuel-in is company-wide, not per vehicle
          partnerId,
          odometer: 0,
          paid: false,
          dueDate: '',
          total,
          lineCount: 1,
          note: `น้ำมันเข้าคลัง ${form.liters} ลิตร${form.invoiceNo ? ` · ${form.invoiceNo}` : ''}`,
        })
        await insertExpenseLine.mutateAsync({
          headerId: header.id,
          item: 'น้ำมันดีเซล',
          qty: Number(form.liters),
          unitPrice: Number(form.pricePerL),
          amount: total,
        })
        expenseHeaderId = header.id
      }

      // 3) Write the fuel_stock entry, linked to the expense if one was created.
      await insertStock.mutateAsync({
        id: uid('fs'),
        date: form.date,
        recordedAt: new Date().toISOString(),
        supplier: partnerName,        // keep readable string for legacy reports
        liters: Number(form.liters),
        pricePerL: Number(form.pricePerL) || 0,
        invoiceNo: form.invoiceNo,
        total,
        expenseHeaderId,
      })
      onSaved()
    } catch (e) {
      setErr('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
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
          {/* Audit strip */}
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
              {isBackdated
                ? <div style={{ fontSize: 11, marginTop: 4, color: '#7C3AED', fontWeight: 500 }}>⬅️ ย้อนหลัง — รายงานใช้วันนี้ถูกต้อง</div>
                : <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>💡 ใส่ย้อนหลังได้ (เช่น 15/04)</div>
              }
            </Field>
            <Field label="จำนวนลิตร *">
              <input type="number" step="0.01" value={form.liters} onChange={e => set('liters', e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          <Field label="แหล่งน้ำมัน / ผู้จำหน่าย *">
            <select value={form.supplierId} onChange={e => set('supplierId', e.target.value)}>
              <option value="">-- เลือกผู้จำหน่าย --</option>
              {fuelSuppliers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="__new__">+ เพิ่มผู้จำหน่ายใหม่</option>
            </select>
          </Field>

          {isNewSupplier && (
            <Field label="ชื่อผู้จำหน่ายใหม่ *">
              <input
                value={form.newSupplierName}
                onChange={e => set('newSupplierName', e.target.value)}
                placeholder="เช่น บริษัท สตาร์ปิโตรเลียม"
                autoFocus
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                จะถูกเพิ่มเข้าทะเบียนคู่ค้า (type: ซัพพลายเออร์น้ำมัน) อัตโนมัติ
              </div>
            </Field>
          )}

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

          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
              border: '1px solid var(--line)', borderRadius: 8, cursor: canRecordExpense ? 'pointer' : 'not-allowed',
              background: form.recordExpense && canRecordExpense ? 'var(--primary-50)' : 'var(--bg-sunk)',
              opacity: canRecordExpense ? 1 : 0.55,
            }}
          >
            <input
              type="checkbox"
              checked={form.recordExpense && canRecordExpense}
              disabled={!canRecordExpense}
              onChange={e => set('recordExpense', e.target.checked)}
              style={{ marginTop: 3, accentColor: 'var(--primary)' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>บันทึกเป็นค่าใช้จ่ายด้วย</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {canRecordExpense
                  ? 'สร้างใบค่าใช้จ่ายผูกกับผู้จำหน่ายอัตโนมัติ (status: ยังไม่ชำระ) — partner.balance จะอัปเดต'
                  : 'ใส่ราคา/ลิตรก่อนเพื่อสร้างค่าใช้จ่าย — ปลดเช็คได้ถ้าเป็น "ยอดยกมา"'}
              </div>
            </div>
          </label>
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

// ─── Edit Stock In Modal ──────────────────────────────────────────────────────
// Admin-only. Updates the fuel_stock row and, when the row is linked to an
// expense_header (auto-created at add time), keeps the AP entry in sync so
// inventory totals and the ledger don't drift.
function EditStockModal({ stock, onClose, onSaved }: { stock: FuelStock; onClose: () => void; onSaved: () => void }) {
  const todayISO = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: stock.date,
    liters: String(stock.liters),
    pricePerL: String(stock.pricePerL ?? ''),
    supplierId: '',
    invoiceNo: stock.invoiceNo ?? '',
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: partners = [] } = useList<Partner>('partners')
  const { data: expenseLines = [] } = useList<ExpenseLine>('expense_lines')
  const updateStock  = useUpdate<FuelStock>('fuel_stock')
  const updateHeader = useUpdate<ExpenseHeader>('expense_headers')
  const updateLine   = useUpdate<ExpenseLine>('expense_lines')

  const fuelSuppliers = useMemo(
    () => partners.filter(p => p.type === FUEL_PARTNER_TYPE && p.status === 'active'),
    [partners],
  )

  // Resolve the supplierId from the stored supplier name once partners load.
  useMemo(() => {
    if (!form.supplierId && fuelSuppliers.length > 0) {
      const match = fuelSuppliers.find(p => p.name === stock.supplier)
      if (match) setForm(f => ({ ...f, supplierId: match.id }))
    }
  }, [fuelSuppliers, stock.supplier, form.supplierId])

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const total = (Number(form.liters) || 0) * (Number(form.pricePerL) || 0)
  const isBackdated = form.date < todayISO

  const save = async () => {
    if (!form.liters || Number(form.liters) <= 0) return setErr('กรุณาระบุจำนวนลิตร (> 0)')
    if (!form.supplierId)                          return setErr('กรุณาเลือกผู้จำหน่าย')
    if (form.date > todayISO)                      return setErr('วันที่เกิดเหตุไม่สามารถเป็นอนาคตได้')

    setSaving(true)
    try {
      const partnerName = fuelSuppliers.find(p => p.id === form.supplierId)?.name ?? stock.supplier

      await updateStock.mutateAsync({
        id: stock.id,
        patch: {
          date: form.date,
          supplier: partnerName,
          liters: Number(form.liters),
          pricePerL: Number(form.pricePerL) || 0,
          invoiceNo: form.invoiceNo,
          total,
        },
      })

      if (stock.expenseHeaderId) {
        await updateHeader.mutateAsync({
          id: stock.expenseHeaderId,
          patch: {
            date: form.date,
            partnerId: form.supplierId,
            total,
            note: `น้ำมันเข้าคลัง ${form.liters} ลิตร${form.invoiceNo ? ` · ${form.invoiceNo}` : ''}`,
          },
        })
        const line = expenseLines.find(l => l.headerId === stock.expenseHeaderId)
        if (line) {
          await updateLine.mutateAsync({
            id: line.id,
            patch: {
              qty: Number(form.liters),
              unitPrice: Number(form.pricePerL) || 0,
              amount: total,
            },
          })
        }
      }

      onSaved()
    } catch (e) {
      setErr('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>✏️ แก้ไขน้ำมันเข้าคลัง</h2>
          <button className="btn ghost icon" onClick={onClose} style={{ padding: 4 }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {err && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>
            {err}
          </div>
        )}

        {stock.expenseHeaderId && (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#1E40AF' }}>
            🔗 รายการนี้ผูกกับใบค่าใช้จ่าย — การแก้ไขจะอัปเดตยอด AP ตามไปด้วย
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันที่เกิดเหตุ *">
              <input type="date" value={form.date} max={todayISO} onChange={e => set('date', e.target.value)} />
              {isBackdated && <div style={{ fontSize: 11, marginTop: 4, color: '#7C3AED', fontWeight: 500 }}>⬅️ ย้อนหลัง</div>}
            </Field>
            <Field label="จำนวนลิตร *">
              <input type="number" step="0.01" value={form.liters} onChange={e => set('liters', e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          <Field label="แหล่งน้ำมัน / ผู้จำหน่าย *">
            <select value={form.supplierId} onChange={e => set('supplierId', e.target.value)}>
              <option value="">-- เลือกผู้จำหน่าย --</option>
              {fuelSuppliers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {!fuelSuppliers.find(p => p.id === form.supplierId) && stock.supplier && (
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>
                ผู้จำหน่ายเดิม: <strong>{stock.supplier}</strong> (เลือกใหม่หรือเพิ่มเข้าทะเบียนคู่ค้าก่อน)
              </div>
            )}
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
  canEdit?: boolean
  canDelete?: boolean
  canSeeMoney?: boolean
  onEdit?: (stock: FuelStock) => void
  onDelete?: (id: string) => void
}

function StockHistoryModal({ type, balanceMap, onClose, canEdit, canDelete, canSeeMoney = true, onEdit, onDelete }: HistoryModalProps) {
  const [page, setPage] = useState(1)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterVehicle, setFilterVehicle] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: dispatches = [] } = useDispatches()
  const { data: allFuelTxs = [] } = useList<FuelTransaction>('fuel_transactions')
  const { data: allFuelStock = [] } = useList<FuelStock>('fuel_stock')
  const factoryTxs = allFuelTxs.filter(t => t.source === 'FACTORY_TANK' && t.status !== 'REVERSED')

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
    <ModalOverlay className="hist-overlay" onClose={onClose}>
      <div className="hist-box" style={{ background: 'var(--card)', borderRadius: 14, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        {/* Print-only KPS header */}
        <div className="kps-print-header print-only">
          <p className="co">KPS Transportations</p>
          <p className="ttl">{type === 'in' ? 'รายงานน้ำมันเข้าคลัง (Stock In)' : 'รายงานน้ำมันออกคลัง (Stock Out)'}</p>
          <p className="sub">{filtered.length} รายการ</p>
          <p className="ts">พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</p>
        </div>

        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {type === 'in' ? '📥 ประวัติน้ำมันเข้า (Stock In)' : '📤 ประวัติน้ำมันออก (Stock Out)'}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{filtered.length} รายการ</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FontScaleControl />
            <PrintButton orientation="landscape" label="พิมพ์" className="btn sm no-print" />
            <button className="btn ghost icon no-print" onClick={onClose}><Icon name="close" size={16} /></button>
          </div>
        </div>

        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13 }} title="จากวันที่" />
          <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13 }} title="ถึงวันที่" />
          {type === 'in'
            ? <input value={filterSupplier} onChange={e => { setFilterSupplier(e.target.value); setPage(1) }} placeholder="ค้นหาผู้จำหน่าย" style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, width: 180 }} />
            : <input value={filterVehicle} onChange={e => { setFilterVehicle(e.target.value); setPage(1) }} placeholder="ค้นหาทะเบียนรถ" style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, width: 180 }} />
          }
          {(filterFrom || filterTo || filterVehicle || filterSupplier) && (
            <button className="btn sm" onClick={resetFilters}>รีเซ็ต</button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="tbl print-compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>วันที่เกิดเหตุ</th>
                <th className="num right">ลิตร</th>
                {type === 'in' ? (
                  <>
                    <th>ผู้จำหน่าย</th>
                    {canSeeMoney && <th className="num right">ราคา/ลิตร</th>}
                    {canSeeMoney && <th className="num right">มูลค่า</th>}
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
                {type === 'in' && (canEdit || canDelete) && <th className="no-print" style={{ width: 80 }}></th>}
              </tr>
            </thead>
            <tbody className="hist-screen-only">
              {paginated.length === 0 ? (
                <tr><td colSpan={type === 'in'
                  ? 5 + (canSeeMoney ? 2 : 0) + (canEdit || canDelete ? 1 : 0)
                  : 7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>ไม่พบข้อมูล</td></tr>
              ) : paginated.map(r => {
                const balance = balanceMap[(r as { id: string }).id]
                if (type === 'in') {
                  const s = r as FuelStock
                  const backdated = s.recordedAt && s.recordedAt.slice(0, 10) > s.date
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="mono" style={{ fontSize: 12.5 }}>{db.thaiDate(s.date)}</div>
                        {backdated && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>⬅️ ย้อนหลัง</div>}
                      </td>
                      <td className="num right mono" style={{ color: 'var(--green)', fontWeight: 600 }}>+{db.fmt(s.liters)}</td>
                      <td style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.supplier}</td>
                      {canSeeMoney && <td className="num right mono muted">{s.pricePerL ? s.pricePerL.toFixed(2) : '—'}</td>}
                      {canSeeMoney && <td className="num right mono">{s.total ? db.thb(s.total) : '—'}</td>}
                      <td className="muted" style={{ fontSize: 12 }}>{s.invoiceNo || '—'}</td>
                      <td className="muted" style={{ fontSize: 11 }}>
                        {s.recordedAt ? new Date(s.recordedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="num right mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{balance != null ? db.fmt(balance) : '—'}</td>
                      {(canEdit || canDelete) && (
                        <td className="no-print">
                          <div style={{ display: 'flex', gap: 2 }}>
                            {canEdit && onEdit && (
                              <button className="btn ghost icon sm" onClick={() => onEdit(s)} title="แก้ไขรายการ">
                                <Icon name="edit" size={13} />
                              </button>
                            )}
                            {canDelete && onDelete && (
                              <button className="btn ghost icon sm" style={{ color: 'var(--red)' }} onClick={() => onDelete(s.id)} title="ลบรายการ">
                                <Icon name="trash" size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                } else {
                  const t = r as FuelTransaction
                  const plate = vehicles.find(v => v.id === t.vehicleId)?.plate ?? '—'
                  const tripCode = dispatches.find(d => d.id === t.tripId)?.code ?? (t.tripId ? '…' : '—')
                  const backdated = t.createdAt && t.createdAt.slice(0, 10) > t.date
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="mono" style={{ fontSize: 12.5 }}>{db.thaiDate(t.date)}</div>
                        {backdated && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>⬅️ ย้อนหลัง</div>}
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
                        {t.createdAt ? new Date(t.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="num right mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{balance != null ? db.fmt(balance) : '—'}</td>
                    </tr>
                  )
                }
              })}
            </tbody>
            <tbody className="hist-print-all">
              {filtered.map(r => {
                const balance = balanceMap[(r as { id: string }).id]
                if (type === 'in') {
                  const s = r as FuelStock
                  return (
                    <tr key={s.id}>
                      <td className="mono">{db.thaiDate(s.date)}</td>
                      <td className="num right mono" style={{ color: 'var(--green)', fontWeight: 600 }}>+{db.fmt(s.liters)}</td>
                      <td>{s.supplier}</td>
                      {canSeeMoney && <td className="num right mono">{s.pricePerL ? s.pricePerL.toFixed(2) : '—'}</td>}
                      {canSeeMoney && <td className="num right mono">{s.total ? db.thb(s.total) : '—'}</td>}
                      <td>{s.invoiceNo || '—'}</td>
                      <td>{s.recordedAt ? new Date(s.recordedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                      <td className="num right mono" style={{ fontWeight: 600 }}>{balance != null ? db.fmt(balance) : '—'}</td>
                    </tr>
                  )
                } else {
                  const t = r as FuelTransaction
                  const plate = vehicles.find(v => v.id === t.vehicleId)?.plate ?? '—'
                  const tripCode = dispatches.find(d => d.id === t.tripId)?.code ?? (t.tripId ? '…' : '—')
                  return (
                    <tr key={t.id}>
                      <td className="mono">{db.thaiDate(t.date)}</td>
                      <td className="num right mono" style={{ color: '#DC2626', fontWeight: 600 }}>−{db.fmt(t.liters)}</td>
                      <td className="mono">{plate}</td>
                      <td className="mono">{tripCode}</td>
                      <td>{t.tripFuelRole === 'TRIP_OPENING' ? 'ต้นรอบ' : t.tripFuelRole === 'TRIP_CLOSING' ? 'ปลายรอบ' : t.tripFuelRole === 'INTERMEDIATE' ? 'กลางทาง' : 'ทั่วไป'}</td>
                      <td>{t.createdAt ? new Date(t.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                      <td className="num right mono" style={{ fontWeight: 600 }}>{balance != null ? db.fmt(balance) : '—'}</td>
                    </tr>
                  )
                }
              })}
            </tbody>
          </table>
        </div>

        <div className="hist-screen-only" style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>หน้า {page} / {totalPages} · {filtered.length} รายการ</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← ก่อนหน้า</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return (
                <button key={pg} className="btn sm"
                  style={{ background: pg === page ? 'var(--primary)' : 'transparent', color: pg === page ? '#fff' : 'var(--text-2)', minWidth: 32 }}
                  onClick={() => setPage(pg)}>{pg}</button>
              )
            })}
            <button className="btn sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>ถัดไป →</button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function FuelStockDashboard() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStock, setEditingStock] = useState<FuelStock | null>(null)
  const [historyType, setHistoryType] = useState<'in' | 'out' | null>(null)
  const [showAllPump, setShowAllPump] = useState(false)

  // Auth source moved to Supabase — db.currentUser() reads the legacy
  // localStorage session which is now empty, so the admin-only buttons
  // were never rendering.
  const { isAdmin, isManager, legacyUser } = useAuth()
  const canAdd = legacyUser?.role !== 'driver'
  const canEdit = isAdmin
  const canDelete = isAdmin

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: dispatches = [] } = useDispatches()
  const { data: allFuelTxs = [] } = useList<FuelTransaction>('fuel_transactions')
  const { data: allFuelStock = [] } = useList<FuelStock>('fuel_stock')
  const deleteStock = useDelete('fuel_stock')
  const factoryTxs = useMemo(
    () => allFuelTxs.filter(t => t.source === 'FACTORY_TANK' && t.status !== 'REVERSED'),
    [allFuelTxs],
  )

  // Running balance per record
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

  // KPIs
  const currentBalance = allFuelStock.reduce((s, r) => s + r.liters, 0) - factoryTxs.reduce((s, t) => s + t.liters, 0)
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayIn = allFuelStock.filter(s => s.date === todayISO).reduce((s, r) => s + r.liters, 0)
  const todayOut = factoryTxs.filter(t => t.date === todayISO).reduce((s, t) => s + t.liters, 0)
  const totalStockValue = allFuelStock.reduce((s, r) => s + r.total, 0)
  const totalLitersEver = allFuelStock.reduce((s, r) => s + r.liters, 0)
  const avgPrice = totalLitersEver > 0 ? totalStockValue / totalLitersEver : 0

  // Recent lists
  const recentIn = useMemo(
    () => [...allFuelStock].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [allFuelStock],
  )
  const recentOut = useMemo(
    () => [...factoryTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [factoryTxs],
  )

  // External-pump fills are an AP cost (not an on-site stock draw). Show the
  // 5 latest with a "view all" toggle so the full history is reachable.
  const pumpTxs = useMemo(
    () => allFuelTxs
      .filter(t => t.source === 'EXTERNAL_PUMP' && t.status !== 'REVERSED')
      .sort((a, b) => b.date.localeCompare(a.date)),
    [allFuelTxs],
  )
  const pumpShown = showAllPump ? pumpTxs : pumpTxs.slice(0, 5)
  const pumpTotalValue = pumpTxs.reduce((s, t) => s + (t.total ?? 0), 0)
  const pumpTotalLiters = pumpTxs.reduce((s, t) => s + (t.liters ?? 0), 0)

  const deleteStockIn = async (id: string) => {
    if (!confirm('ลบรายการน้ำมันเข้านี้?')) return
    await deleteStock.mutateAsync(id)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ภาพรวมคลังน้ำมัน</h1>
          <div className="page-sub">ยอดคงเหลือ · ประวัติรับเข้า-จ่ายออก</div>
        </div>
        <div className="actions">
          {canAdd && (
            <button className="btn primary" onClick={() => setShowAddModal(true)}>
              <Icon name="plus" size={15} /> เพิ่มน้ำมันเข้าคลัง
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20, gap: 14 }}>
        <div className="card kpi">
          <div className="label">⛽ ยอดคลังปัจจุบัน</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: currentBalance < 100 ? 'var(--red)' : 'var(--green)' }}>
            {db.fmt(Math.max(0, currentBalance))} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ลิตร</span>
          </div>
          {isManager && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>ราคาเฉลี่ย {avgPrice.toFixed(2)} บาท/ลิตร</div>
          )}
        </div>
        <div className="card kpi">
          <div className="label">📥 เข้าวันนี้</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: todayIn > 0 ? '#166534' : 'var(--text-muted)' }}>
            {db.fmt(todayIn)} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">📤 ออกวันนี้ (ถังโรงงาน)</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: todayOut > 0 ? '#A32D2D' : 'var(--text-muted)' }}>
            {db.fmt(todayOut)} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">📦 รับเข้าทั้งหมด</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
            {db.fmt(totalLitersEver)} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ลิตร</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            {allFuelStock.length} รายการ{isManager && ` · ${db.thb(totalStockValue)}`}
          </div>
        </div>
      </div>

      {/* Stock In Recent */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head">
          <div style={{ flex: 1 }}>
            <h3>📥 ประวัติน้ำมันเข้าคลัง (Stock In) — 5 รายการล่าสุด</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>รวม {allFuelStock.length} รายการทั้งหมด</div>
          </div>
          <button className="btn sm outline" onClick={() => setHistoryType('in')}>📂 ดูประวัติเข้าทั้งหมด</button>
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
                  {isManager && <th className="right">ราคา/ลิตร</th>}
                  {isManager && <th className="right">มูลค่า</th>}
                  <th>เลขใบส่งของ</th>
                  <th>บันทึกเมื่อ</th>
                  <th className="right">ยอดสะสม</th>
                  {(canEdit || canDelete) && <th style={{ width: 80 }}></th>}
                </tr>
              </thead>
              <tbody>
                {recentIn.map(s => {
                  const backdated = s.recordedAt && s.recordedAt.slice(0, 10) > s.date
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="mono" style={{ fontSize: 12.5 }}>{db.thaiDate(s.date)}</div>
                        {backdated && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>⬅️ ย้อนหลัง</div>}
                      </td>
                      <td style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.supplier}</td>
                      <td className="num right mono" style={{ color: '#166534', fontWeight: 600 }}>+{db.fmt(s.liters)}</td>
                      {isManager && <td className="num right muted" style={{ fontSize: 12 }}>{s.pricePerL ? s.pricePerL.toFixed(2) : '—'}</td>}
                      {isManager && <td className="num right mono">{s.total ? db.thb(s.total) : '—'}</td>}
                      <td className="muted" style={{ fontSize: 12 }}>{s.invoiceNo || '—'}</td>
                      <td className="muted" style={{ fontSize: 11 }}>
                        {s.recordedAt ? new Date(s.recordedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="num right mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {balanceMap[s.id] != null ? db.fmt(balanceMap[s.id]) : '—'}
                      </td>
                      {(canEdit || canDelete) && (
                        <td>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {canEdit && (
                              <button className="btn ghost icon sm" onClick={() => setEditingStock(s)} title="แก้ไขรายการ">
                                <Icon name="edit" size={13} />
                              </button>
                            )}
                            {canDelete && (
                              <button className="btn ghost icon sm" style={{ color: 'var(--red)' }} onClick={() => deleteStockIn(s.id)} title="ลบรายการ">
                                <Icon name="trash" size={13} />
                              </button>
                            )}
                          </div>
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

      {/* Stock Out Recent */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="head">
          <div style={{ flex: 1 }}>
            <h3>📤 ประวัติน้ำมันออกคลัง (Stock Out) — 10 รายการล่าสุด</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>เฉพาะการเติมจากถังโรงงาน</div>
          </div>
          <button className="btn sm outline" onClick={() => setHistoryType('out')}>📂 ดูประวัติออกทั้งหมด</button>
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
                        <span className="badge" style={{
                          fontSize: 10.5,
                          background: t.tripFuelRole === 'TRIP_OPENING' ? '#EFF6FF' : t.tripFuelRole === 'TRIP_CLOSING' ? '#F0FDF4' : t.tripFuelRole === 'INTERMEDIATE' ? '#FFF7ED' : 'var(--bg)',
                          color: t.tripFuelRole === 'TRIP_OPENING' ? '#1D4ED8' : t.tripFuelRole === 'TRIP_CLOSING' ? '#166534' : t.tripFuelRole === 'INTERMEDIATE' ? '#C2410C' : 'var(--text-2)',
                        }}>
                          {t.tripFuelRole === 'TRIP_OPENING' ? '🔵 ต้นรอบ' : t.tripFuelRole === 'TRIP_CLOSING' ? '🟢 ปลายรอบ' : t.tripFuelRole === 'INTERMEDIATE' ? '🟠 กลางทาง' : '⚪ ทั่วไป'}
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

      {/* External-pump history */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="head">
          <div style={{ flex: 1 }}>
            <h3>⛽ ประวัติเติมปั๊มภายนอก (External Pump){!showAllPump && pumpTxs.length > 5 ? ' — 5 รายการล่าสุด' : ''}</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              รวม {pumpTxs.length} รายการ · {db.fmt(pumpTotalLiters)} ลิตร{isManager && ` · ${db.thb(pumpTotalValue)}`}
            </div>
          </div>
          {pumpTxs.length > 5 && (
            <button className="btn sm outline" onClick={() => setShowAllPump(v => !v)}>
              {showAllPump ? '▲ ย่อ (5 ล่าสุด)' : `📂 ดูทั้งหมด (${pumpTxs.length})`}
            </button>
          )}
        </div>
        {pumpShown.length === 0 ? (
          <div className="empty" style={{ padding: 32 }}>ยังไม่มีรายการเติมปั๊มภายนอก</div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ทะเบียนรถ</th>
                  <th>รอบงาน</th>
                  <th className="right">ลิตร</th>
                  {isManager && <th className="right">ราคา/ลิตร</th>}
                  {isManager && <th className="right">มูลค่า</th>}
                </tr>
              </thead>
              <tbody>
                {pumpShown.map(t => {
                  const plate = vehicles.find(v => v.id === t.vehicleId)?.plate ?? '—'
                  const trip = dispatches.find(d => d.id === t.tripId)
                  return (
                    <tr key={t.id}>
                      <td className="mono muted">{db.thaiDate(t.date)}</td>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{plate}</td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{trip?.code ?? (t.tripId ? '…' : '—')}</td>
                      <td className="num right mono" style={{ color: '#C2410C', fontWeight: 600 }}>{db.fmt(t.liters)}</td>
                      {isManager && <td className="num right muted" style={{ fontSize: 12 }}>{t.pricePerL ? t.pricePerL.toFixed(2) : '—'}</td>}
                      {isManager && <td className="num right mono">{t.total ? db.thb(t.total) : '—'}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} onSaved={() => setShowAddModal(false)} />}
      {editingStock && <EditStockModal stock={editingStock} onClose={() => setEditingStock(null)} onSaved={() => setEditingStock(null)} />}
      {historyType && (
        <StockHistoryModal
          type={historyType}
          balanceMap={balanceMap}
          onClose={() => setHistoryType(null)}
          canEdit={canEdit}
          canDelete={canDelete}
          canSeeMoney={isManager}
          onEdit={(s) => { setHistoryType(null); setEditingStock(s) }}
          onDelete={(id) => { void deleteStockIn(id) }}
        />
      )}
    </div>
  )
}
