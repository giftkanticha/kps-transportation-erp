import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import type { User, Vehicle, Employee, Tire, ActivityLog, StockItem, Customer, SubJob, ExpenseHeader, Partner, EditApprovalRequest, BillingNote, Location, DispatchLeg } from '../../types'
import { Icon, StatusBadge } from '../../components/ui'
import { canAccessRoute } from '../../lib/permissions'

// ─── Mock data ─────────────────────────────────────────────────────────────────
interface RegItem {
  id: number; plate: string; label: string; type: string; dueDate: string; status: 'warning' | 'critical'
}
interface ReqItem {
  id: number; title: string; desc: string; time: string; priority: 'critical' | 'warning' | 'info'
}

// Renewals + employee requests used to be hard-coded demo data — kept the
// types but the arrays are now computed from real DB rows below.
const TODAY_ISO = new Date().toISOString().slice(0, 10)
function daysTo(date: string | null | undefined): number | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date(TODAY_ISO)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}
function thaiShortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${(d.getFullYear() + 543).toString().slice(-2)}`
}

// ─── Priority helpers ──────────────────────────────────────────────────────────
const P_COLOR = { critical: '#EF4444', warning: '#F59E0B', info: '#3B82F6', success: '#10B981' } as const
const P_BG    = { critical: '#FEF2F2', warning: '#FFFBEB', info: '#EFF6FF', success: '#F0FDF4' } as const
const P_LABEL = { critical: 'เร่งด่วน', warning: 'ควรดำเนินการ', info: 'ทั่วไป', success: 'เสร็จแล้ว' } as const

// ─── Modal overlay ─────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

// ─── Registration Modal ────────────────────────────────────────────────────────
function RegistrationModal({ reg, onClose }: { reg: RegItem; onClose: () => void }) {
  const todayISO = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: todayISO, type: reg.type, duration: '1', cost: '', notes: '',
    payDate: todayISO, payMethod: 'cash', payRef: '',
    nextDate: '', nextNotes: '',
  })
  const [saving, setSaving] = useState(false)
  const insertReg = useInsert<{ data: Record<string, unknown> }>('vehicle_registrations')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const sectionStyle = { background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }
  const sectionLabel = { fontSize: 11, fontWeight: 700 as const, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 12 }
  const inputStyle = { width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' as const, background: '#fff' }
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', display: 'block' as const, marginBottom: 5 }

  const save = async () => {
    if (!form.cost || !form.date) return
    setSaving(true)
    try {
      await insertReg.mutateAsync({
        data: {
          plate: reg.plate,
          label: reg.label,
          date: form.date,
          type: form.type,
          duration: form.duration,
          cost: Number(form.cost),
          notes: form.notes,
          payDate: form.payDate,
          payMethod: form.payMethod,
          payRef: form.payRef,
          nextDate: form.nextDate,
          nextNotes: form.nextNotes,
        },
      })
      onClose()
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📋 {reg.type}</h2>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>ทะเบียน {reg.plate} ({reg.label})</div>
          </div>
          <button className="btn ghost icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        {/* Section 1 */}
        <div style={sectionStyle}>
          <div style={sectionLabel}>การต่อทะเบียนครั้งนี้</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>วันที่ต่อ *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>ประเภทต่อ</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>
                <option>ต่อภาษีรถ</option>
                <option>ต่อประกันภัยรถ</option>
                <option>ต่อใบขับขี่</option>
                <option>ต่อทะเบียนรถ</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>ระยะเวลา *</label>
              <select value={form.duration} onChange={e => set('duration', e.target.value)} style={inputStyle}>
                <option value="1">1 ปี</option>
                <option value="2">2 ปี</option>
                <option value="3">3 ปี</option>
                <option value="5">5 ปี</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>ค่าใช้จ่าย (บาท) *</label>
              <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>หมายเหตุ</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Section 2 */}
        <div style={sectionStyle}>
          <div style={sectionLabel}>ข้อมูลชำระเงิน</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>วันที่จ่ายเงิน *</label>
              <input type="date" value={form.payDate} onChange={e => set('payDate', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>วิธีชำระเงิน</label>
              <select value={form.payMethod} onChange={e => set('payMethod', e.target.value)} style={inputStyle}>
                <option value="cash">เงินสด</option>
                <option value="transfer">โอน</option>
                <option value="check">เช็ค</option>
                <option value="credit">บัตรเครดิต</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>เลขอ้างอิง (ใบเสร็จ / โอน)</label>
            <input value={form.payRef} onChange={e => set('payRef', e.target.value)} placeholder="REF-XXXXXXX" style={inputStyle} />
          </div>
          {Number(form.cost) > 0 && (
            <div style={{ marginTop: 12, background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#1D4ED8' }}>{form.type} · {form.duration} ปี</span>
              <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: '#1D4ED8' }}>{db.thb(Number(form.cost))}</span>
            </div>
          )}
        </div>

        {/* Section 3 */}
        <div style={{ ...sectionStyle, marginBottom: 22 }}>
          <div style={sectionLabel}>ตั้งเตือนครั้งต่อไป</div>
          <div>
            <label style={labelStyle}>วันที่ต่อครั้งต่อไป</label>
            <input type="date" value={form.nextDate} onChange={e => set('nextDate', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>หมายเหตุ</label>
            <textarea value={form.nextNotes} onChange={e => set('nextNotes', e.target.value)} rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={saving || !form.cost}>
            <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'บันทึกและอนุมัติ'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Approval Modal ────────────────────────────────────────────────────────────
function ApprovalModal({ req, onClose }: { req: ReqItem; onClose: () => void }) {
  const [form, setForm] = useState({ status: 'approved', notes: '', autoUpdate: false, updateData: '' })
  const [saving, setSaving] = useState(false)
  const insertRA = useInsert<{ data: Record<string, unknown> }>('request_approvals')
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const pColor = P_COLOR[req.priority]
  const pBg    = P_BG[req.priority]

  const save = async () => {
    setSaving(true)
    try {
      await insertRA.mutateAsync({
        data: {
          requestId: req.id,
          title: req.title,
          status: form.status,
          notes: form.notes,
          autoUpdate: form.autoUpdate,
          updateData: form.updateData,
          approvedAt: new Date().toISOString(),
        },
      })
      onClose()
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>✅ อนุมัติคำขอ</h2>
          <button className="btn ghost icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div style={{ background: pBg, borderLeft: `3px solid ${pColor}`, borderRadius: '0 8px 8px 0', padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: pColor }}>{req.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{req.desc}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>ส่งมาเมื่อ {req.time}ที่แล้ว</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>สถานะ *</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13 }}>
              <option value="approved">✅ อนุมัติ</option>
              <option value="rejected">❌ ปฏิเสธ</option>
              <option value="pending_more">⏳ ต้องการข้อมูลเพิ่ม</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>หมายเหตุการอนุมัติ</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              placeholder="ระบุเหตุผลหรือรายละเอียด…"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={form.autoUpdate} onChange={e => set('autoUpdate', e.target.checked)}
              style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
            <span>อัพเดตข้อมูลในระบบทันที</span>
          </label>
          {form.autoUpdate && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>รายละเอียดข้อมูลที่แก้</label>
              <textarea value={form.updateData} onChange={e => set('updateData', e.target.value)} rows={2}
                placeholder="ระบุข้อมูลที่ต้องการอัพเดต…"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'บันทึกการอนุมัติ'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
interface DashboardProps {
  user: User
  setActive: (id: string) => void
}

export function Dashboard({ user, setActive }: DashboardProps) {
  const [regModal, setRegModal]         = useState<RegItem | null>(null)
  const [approvalModal, setApprovalModal] = useState<ReqItem | null>(null)
  const [dismissedReqs, setDismissedReqs] = useState<Set<number>>(new Set())
  const [showExport, setShowExport]       = useState(false)

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatch = [] } = useDispatches()
  const { data: customers = [] } = useList<Customer>('customers')
  const { data: tires = [] } = useList<Tire>('tires')
  const { data: activity = [] } = useList<ActivityLog>('activity_logs')
  const { data: stock = [] } = useList<StockItem>('stock_items')
  const { data: subJobs = [] } = useList<SubJob>('sub_jobs')
  const { data: billingNotes = [] } = useList<BillingNote>('billing_notes')
  const { data: locationsD = [] } = useList<Location>('locations')

  const netOf = (j: SubJob) => (j.total || 0) - (j.wht ? (j.total || 0) * 0.01 : 0)
  const subUnpaid      = useMemo(() => subJobs.filter(j => j.status === 'unpaid'), [subJobs])
  const subUnpaidTotal = useMemo(() => subUnpaid.reduce((s, j) => s + netOf(j), 0), [subUnpaid])

  const { data: expHeaders = [] } = useList<ExpenseHeader>('expense_headers')
  const { data: editApprovals = [] } = useList<EditApprovalRequest>('edit_approvals')
  const { data: sbPartners = [] } = useList<Partner>('partners')

  const onTrip    = useMemo(() => dispatch.filter(t => t.status === 'in-progress'), [dispatch])
  const scheduled = useMemo(() => dispatch.filter(t => t.status === 'scheduled'), [dispatch])
  const delivered = useMemo(() => dispatch.filter(t => t.status === 'completed'), [dispatch])

  // Current calendar month, string-compared to avoid timezone drift on
  // 'YYYY-MM-DD' values. These KPIs are labelled "เดือนนี้" so they MUST be
  // scoped to this month (they used to sum all-time and mislabel it).
  const thisMonthPrefix = useMemo(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const inThisMonth = (iso: string | null | undefined) => !!iso && iso.slice(0, 7) === thisMonthPrefix
  const revenueThisMonth = useMemo(
    () => dispatch.filter(t => inThisMonth(t.depart || t.date)).reduce((s, t) => s + db.amountOf(t), 0),
    [dispatch, thisMonthPrefix],
  )
  const costThisMonth    = useMemo(
    () => dispatch.filter(t => inThisMonth(t.depart || t.date)).reduce((s, t) => s + (t.cost || 0), 0)
        + expHeaders.filter(h => inThisMonth(h.date)).reduce((s, h) => s + (h.total || 0), 0),
    [dispatch, expHeaders, thisMonthPrefix],
  )

  const idleVehicles        = vehicles.filter(v => v.status === 'available').length
  const activeVehicles      = vehicles.filter(v => v.status === 'on-trip').length
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length

  // Real notification feed — only items that actually exist in the DB.
  const criticalTireVehicles = useMemo(() => {
    const ids = new Set<string>()
    tires.forEach(t => { if ((t.status as string) === 'critical' && t.vehicleId) ids.add(t.vehicleId) })
    return vehicles.filter(v => ids.has(v.id)).map(v => v.plate)
  }, [tires, vehicles])
  const maintenanceDueVehicles = useMemo(() => {
    return vehicles.filter(v =>
      v.nextServiceKm > 0 && v.odometer > 0 && v.odometer >= v.nextServiceKm - 500,
    )
  }, [vehicles])
  const lowStockItems = useMemo(() => stock.filter(s => s.qty <= s.reorderAt), [stock])
  const customersWithDebt = useMemo(() => customers.filter(c => (c.openInvoice ?? 0) > 0), [customers])
  const totalOpenInvoice  = useMemo(() => customersWithDebt.reduce((s, c) => s + (c.openInvoice ?? 0), 0), [customersWithDebt])

  // AR is per LEG (customer is assigned per leg). A leg is "paid" once it's on a
  // billing note with status 'paid'. Outstanding = closed legs with a customer,
  // net > 0, not yet paid — split into "ยังไม่วางบิล" vs "วางบิลแล้วรอเก็บ".
  // Overdue = beyond the customer's credit terms since the run date.
  const paidLegIds = useMemo(() => {
    const s = new Set<string>()
    for (const n of billingNotes) if (n.status === 'paid') for (const id of n.legIds ?? []) s.add(id)
    return s
  }, [billingNotes])
  const issuedLegIds = useMemo(() => {
    const s = new Set<string>()
    for (const n of billingNotes) if (n.status === 'issued') for (const id of n.legIds ?? []) s.add(id)
    return s
  }, [billingNotes])
  // ผู้รับบิลของขา = สถานที่ที่เป็นลูกค้า (override ก่อน, ไม่งั้น = ปลายทางถ้าเป็นลูกค้า)
  const custLocById = useMemo(() => new Map(locationsD.map(l => [l.id, l])), [locationsD])
  const custLocByName = useMemo(() => {
    const m = new Map<string, Location>()
    for (const l of locationsD) if (l.isCustomer && l.active) m.set(l.name, l)
    return m
  }, [locationsD])
  const billToOf = (leg: DispatchLeg): Location | null =>
    leg.billToLocationId ? (custLocById.get(leg.billToLocationId) ?? null) : (custLocByName.get(leg.destination) ?? null)

  const unpaidByCustomer = useMemo(() => {
    const todayMs = Date.now()
    const map = new Map<string, { name: string; outstanding: number; legs: number; billed: number; overdue: boolean }>()
    for (const d of dispatch) {
      if (d.roundStatus !== 'closed') continue
      const baseDate = (d.returnAt || d.depart || d.date || '').slice(0, 10)
      for (const leg of d.legs ?? []) {
        if (!leg.id || leg.noBill) continue
        const net = (leg.amount || 0) - db.legWht(leg)
        if (net <= 0 || paidLegIds.has(leg.id)) continue
        const loc = billToOf(leg)
        if (!loc) continue
        const cur = map.get(loc.id) ?? { name: loc.name, outstanding: 0, legs: 0, billed: 0, overdue: false }
        cur.outstanding += net
        cur.legs += 1
        if (issuedLegIds.has(leg.id)) cur.billed += 1
        if (baseDate) {
          const dueMs = new Date(baseDate).getTime() + (loc.credit ?? 30) * 86400000
          if (todayMs > dueMs) cur.overdue = true
        }
        map.set(loc.id, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, locationsD, paidLegIds, issuedLegIds])
  const totalUnpaidLegs = useMemo(() => unpaidByCustomer.reduce((s, c) => s + c.legs, 0), [unpaidByCustomer])
  const totalUnpaidAmount = useMemo(() => unpaidByCustomer.reduce((s, c) => s + c.outstanding, 0), [unpaidByCustomer])

  // AP — group unpaid expense_headers by creditor (partner) so the dashboard
  // surfaces 'who owes what' instead of a per-invoice list. Vehicle is
  // intentionally ignored — AP is per-creditor, not per-truck.
  const creditorsWithDebt = useMemo(() => {
    const map = new Map<string, { partner: Partner | undefined; total: number; bills: number; earliestDue: string | null }>()
    const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
    for (const h of expHeaders) {
      if (h.paid) continue
      const key = h.partnerId || '__none__'
      const cur = map.get(key) ?? {
        partner: sbPartners.find(p => p.id === h.partnerId),
        total: 0,
        bills: 0,
        earliestDue: null,
      }
      cur.total += h.total
      cur.bills += 1
      if (h.dueDate && (cur.earliestDue == null || h.dueDate < cur.earliestDue)) cur.earliestDue = h.dueDate
      map.set(key, cur)
    }
    return [...map.values()]
      .map(c => ({ ...c, isOverdue: c.earliestDue != null && new Date(c.earliestDue).getTime() < todayMs }))
      .sort((a, b) => b.total - a.total)
  }, [expHeaders, sbPartners])
  const totalCreditorDebt = useMemo(() => creditorsWithDebt.reduce((s, c) => s + c.total, 0), [creditorsWithDebt])

  const totalAlerts = criticalTireVehicles.length + maintenanceDueVehicles.length + lowStockItems.length + customersWithDebt.length + creditorsWithDebt.length

  const marginPct = revenueThisMonth > 0
    ? Math.round(((revenueThisMonth - costThisMonth) / revenueThisMonth) * 100) : 0

  // Real month-over-month revenue change (was a hardcoded "+12.4%").
  const prevMonthPrefix = useMemo(() => {
    const n = new Date()
    const d = new Date(n.getFullYear(), n.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const revenuePrevMonth = useMemo(
    () => dispatch.filter(t => (t.depart || t.date || '').slice(0, 7) === prevMonthPrefix)
      .reduce((s, t) => s + db.amountOf(t), 0),
    [dispatch, prevMonthPrefix],
  )
  const revenueDelta = useMemo(() => {
    if (revenuePrevMonth <= 0) {
      return { text: 'ไม่มีข้อมูลเดือนก่อน', up: null as boolean | null }
    }
    const pct = Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100)
    return { text: `${pct >= 0 ? '+' : ''}${pct}% จากเดือนก่อน`, up: pct >= 0 }
  }, [revenueThisMonth, revenuePrevMonth])

  const canApprove    = user.role === 'admin' || user.role === 'manager'

  // Vehicle document renewals due within 60 days, computed from real data.
  const renewals = useMemo<RegItem[]>(() => {
    const out: RegItem[] = []
    let id = 0
    const checks: { key: 'tax' | 'insurance' | 'dispatchPermit'; label: string }[] = [
      { key: 'tax',            label: 'ต่อภาษีรถ' },
      { key: 'insurance',      label: 'ต่อประกันภัยรถ' },
      { key: 'dispatchPermit', label: 'ต่อใบอนุญาตขนส่ง' },
    ]
    vehicles.forEach(v => {
      checks.forEach(c => {
        const dateStr = String(v[c.key] ?? '')
        const days = daysTo(dateStr)
        if (days === null || days > 60) return
        out.push({
          id: ++id,
          plate: v.plate,
          label: v.brand || v.type || '',
          type: c.label,
          dueDate: days < 0 ? `หมดอายุแล้ว (${thaiShortDate(dateStr)})` : `${thaiShortDate(dateStr)} (${days} วัน)`,
          status: days <= 7 ? 'critical' : 'warning',
        })
      })
    })
    return out.sort((a, b) => (a.status === 'critical' ? -1 : 1) - (b.status === 'critical' ? -1 : 1))
  }, [vehicles])

  // Dispatch-reopen / vehicle-edit requests waiting on this admin's review.
  // Filter on edit_approvals.status='pending'; dispatch_reopen items get a
  // clearer title showing the round code so admins know what they're acting on.
  const pendingRequests: ReqItem[] = useMemo(() => {
    if (!canApprove) return []
    return editApprovals
      .filter(r => r.status === 'pending' && !dismissedReqs.has(Number(r.id)))
      .sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''))
      .map((r, i) => {
        const changes = r.changes as Record<string, unknown> | undefined
        const isReopen = changes?._kind === 'dispatch_reopen'
        const roundCode = isReopen ? String(changes?.roundCode ?? '') : ''
        const fields = isReopen && Array.isArray(changes?.fields) ? (changes.fields as string[]) : []
        const title = isReopen
          ? `ขอเปิดรอบ ${roundCode} เพื่อแก้ไข`
          : `ขอแก้ไข ${r.vehiclePlate}`
        const ageHrs = Math.max(0, Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 3_600_000))
        return {
          id: typeof r.id === 'number' ? r.id : Number(i + 1),
          title,
          desc: `${r.requesterName}${fields.length > 0 ? ' · ' + fields.join(', ') : ''}${r.reason ? ' — ' + r.reason : ''}`,
          time: ageHrs < 1 ? 'ไม่กี่นาที' : ageHrs < 24 ? `${ageHrs} ชม.` : `${Math.floor(ageHrs / 24)} วัน`,
          priority: 'warning' as const,
        }
      })
  }, [editApprovals, canApprove, dismissedReqs])

  const iconMap:  Record<string, string> = { trip: 'package', alert: 'alert', create: 'plus', approve: 'check', invoice: 'money', fuel: 'fuel' }
  const colorMap: Record<string, string> = { alert: 'red', approve: 'green', fuel: 'amber' }

  const todayLabel = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  // KPI card definitions
  const kpiCards = [
    {
      label: 'รายได้เดือนนี้', value: db.thb(revenueThisMonth), unit: '',
      delta: revenueDelta.text, deltaUp: revenueDelta.up,
      icon: 'money', gradient: 'linear-gradient(135deg,#10B981,#059669)', iconBg: '#D1FAE5', iconColor: '#065F46',
    },
    {
      label: 'กำไรประมาณการ', value: db.thb(revenueThisMonth - costThisMonth), unit: '',
      delta: `margin ~${marginPct}%`, deltaUp: true as boolean | null,
      icon: 'chart', gradient: 'linear-gradient(135deg,#0EA5E9,#0284C7)', iconBg: '#E0F2FE', iconColor: '#075985',
    },
    {
      label: 'งานขนส่งกำลังดำเนินการ', value: `${onTrip.length}`, unit: `/ ${dispatch.length} รวม`,
      delta: `${scheduled.length} นัดหมาย · ${delivered.length} เสร็จ`, deltaUp: null as boolean | null,
      icon: 'package', gradient: 'linear-gradient(135deg,#6366F1,#4F46E5)', iconBg: '#EEF2FF', iconColor: '#3730A3',
    },
    {
      label: 'รถพร้อมใช้งาน', value: `${idleVehicles}`, unit: `/ ${vehicles.length} คัน`,
      delta: `${activeVehicles} ออกงาน · ${maintenanceVehicles} ซ่อม`, deltaUp: null as boolean | null,
      icon: 'truck', gradient: 'linear-gradient(135deg,#F59E0B,#D97706)', iconBg: '#FEF3C7', iconColor: '#92400E',
    },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            สวัสดี{user.role === 'admin' ? '' : ', '}{user.name.split(' ')[0]}
          </h1>
          <div className="page-sub">ภาพรวมการขนส่ง ณ {todayLabel}</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActive('dispatch.open')}>
            <Icon name="plus" size={15} /> เปิดงานใหม่
          </button>
          <button className="btn primary" onClick={() => setShowExport(true)}>
            <Icon name="download" size={15} /> ส่งออกรายงาน
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 22 }}>
        {kpiCards.map((k, i) => (
          <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 4, background: k.gradient }} />
            <div style={{ padding: '16px 20px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>{k.label}</div>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: k.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={k.icon} size={17} style={{ color: k.iconColor }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{k.value}</span>
                {k.unit && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.unit}</span>}
              </div>
              <div style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, color: k.deltaUp === true ? '#059669' : k.deltaUp === false ? '#DC2626' : 'var(--text-muted)' }}>
                {k.deltaUp === true  && <Icon name="arrow-up"   size={11} />}
                {k.deltaUp === false && <Icon name="arrow-down" size={11} />}
                {k.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Middle 2-column section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Alerts */}
          <div className="card">
            <div className="head">
              <h3>การแจ้งเตือน</h3>
              {totalAlerts > 0 && <span className="badge red mono">{totalAlerts}</span>}
            </div>
            <div style={{ padding: '8px 18px' }}>
              {totalAlerts === 0 ? (
                <div className="empty" style={{ padding: 24 }}>ไม่มีการแจ้งเตือนใหม่ ✅</div>
              ) : (
                <div className="feed">
                  {criticalTireVehicles.length > 0 && (
                    <div className="feed-item">
                      <div className="ic red"><Icon name="alert" size={16} /></div>
                      <div className="body">
                        <div className="who">ยางวิกฤติ {criticalTireVehicles.length} คัน</div>
                        <div className="txt">
                          {criticalTireVehicles.slice(0, 3).join(', ')}
                          {criticalTireVehicles.length > 3 && ` และอีก ${criticalTireVehicles.length - 3} คัน`}
                        </div>
                      </div>
                    </div>
                  )}
                  {maintenanceDueVehicles.length > 0 && (
                    <div
                      className="feed-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActive('alerts')}
                      title="กดเพื่อบันทึก 'เปลี่ยนถ่ายแล้ว' + ตั้งไมล์ครั้งถัดไป"
                    >
                      <div className="ic amber"><Icon name="wrench" size={16} /></div>
                      <div className="body">
                        <div className="who">ครบกำหนดบำรุงรักษา {maintenanceDueVehicles.length} คัน</div>
                        <div className="txt">
                          {maintenanceDueVehicles.slice(0, 3).map(v => `${v.plate} (${db.fmt(v.odometer)}/${db.fmt(v.nextServiceKm)} km)`).join(', ')}
                          {maintenanceDueVehicles.length > 3 && ` และอีก ${maintenanceDueVehicles.length - 3}`}
                        </div>
                      </div>
                      <button
                        className="btn sm primary"
                        onClick={(e) => { e.stopPropagation(); setActive('alerts') }}
                        style={{ alignSelf: 'center' }}
                      >
                        เปลี่ยนถ่ายแล้ว <Icon name="arrow-right" size={12} />
                      </button>
                    </div>
                  )}
                  {lowStockItems.length > 0 && (
                    <div className="feed-item">
                      <div className="ic amber"><Icon name="package" size={16} /></div>
                      <div className="body">
                        <div className="who">สต็อคใกล้หมด {lowStockItems.length} รายการ</div>
                        <div className="txt">
                          {lowStockItems.slice(0, 3).map(s => s.name).join(', ')}
                          {lowStockItems.length > 3 && ` และอีก ${lowStockItems.length - 3}`}
                        </div>
                      </div>
                    </div>
                  )}
                  {customersWithDebt.length > 0 && (
                    <div className="feed-item">
                      <div className="ic"><Icon name="money" size={16} /></div>
                      <div className="body">
                        <div className="who">ลูกหนี้คงค้าง {customersWithDebt.length} ราย · รวม {db.thb(totalOpenInvoice)}</div>
                        <div className="txt">
                          {customersWithDebt
                            .slice()
                            .sort((a, b) => (b.openInvoice ?? 0) - (a.openInvoice ?? 0))
                            .slice(0, 3)
                            .map(c => `${c.name} ${db.thb(c.openInvoice)}`)
                            .join(' · ')}
                          {customersWithDebt.length > 3 && ` และอีก ${customersWithDebt.length - 3}`}
                        </div>
                      </div>
                    </div>
                  )}
                  {unpaidByCustomer.length > 0 && (
                    <div className="feed-item" onClick={() => setActive('dispatch.billing')} style={{ cursor: 'pointer' }}>
                      <div className={`ic ${unpaidByCustomer.some(c => c.overdue) ? 'red' : 'amber'}`}><Icon name="money" size={16} /></div>
                      <div className="body">
                        <div className="who">
                          งานปิดแล้วยังไม่ได้รับเงิน {totalUnpaidLegs} ขา · รวม {db.thb(totalUnpaidAmount)}
                          {unpaidByCustomer.some(c => c.overdue) && <span className="badge red" style={{ marginLeft: 8, fontSize: 10.5 }}>เกินกำหนด</span>}
                        </div>
                        <div className="txt">
                          {unpaidByCustomer
                            .slice(0, 3)
                            .map(c => `${c.name} ${db.thb(c.outstanding)}${c.billed < c.legs ? ` (ยังไม่วางบิล ${c.legs - c.billed})` : ''}${c.overdue ? ' ⚠️' : ''}`)
                            .join(' · ')}
                          {unpaidByCustomer.length > 3 && ` และอีก ${unpaidByCustomer.length - 3}`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subcontractor jobs pending payment (to-do) */}
          {subUnpaid.length > 0 && (
            <div className="card">
              <div className="head">
                <h3>💸 รอชำระเงิน — รถรับจ้าง</h3>
                <span className="badge amber mono">{subUnpaid.length}</span>
              </div>
              <div>
                {subUnpaid.slice(0, 6).map(j => (
                  <div
                    key={j.id}
                    onClick={() => setActive('subcontractors.history')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', cursor: 'pointer', borderTop: '1px solid var(--line)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        <span className="mono">{j.plate}</span> → {j.destination}
                      </div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {j.code} · {j.driverName}{j.wht ? ' · หัก ณ ที่จ่าย 1%' : ''}
                      </div>
                    </div>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                      {db.thb(netOf(j))}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '11px 18px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted" style={{ fontSize: 12.5 }}>ยอดสุทธิรวม</span>
                <div className="spacer" />
                <span className="mono" style={{ fontWeight: 800, color: 'var(--primary)' }}>{db.thb(subUnpaidTotal)}</span>
              </div>
              <div style={{ padding: '0 18px 14px' }}>
                <button className="btn sm primary" style={{ width: '100%' }} onClick={() => setActive('subcontractors.history')}>
                  ไปชำระเงิน
                </button>
              </div>
            </div>
          )}

          {/* Expenses pending payment — grouped by creditor (เจ้าหนี้) */}
          {creditorsWithDebt.length > 0 && (
            <div className="card">
              <div className="head">
                <h3>🧾 ค่าใช้จ่ายค้างชำระ (รายเจ้าหนี้)</h3>
                <span className="badge amber mono">{creditorsWithDebt.length}</span>
              </div>
              <div>
                {creditorsWithDebt.slice(0, 8).map((c, i) => (
                  <div
                    key={i}
                    onClick={() => setActive('expenses.finance')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', cursor: 'pointer', borderTop: '1px solid var(--line)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {c.partner?.name ?? '— ไม่ระบุเจ้าหนี้ —'}
                        {c.isOverdue && <span className="badge red" style={{ marginLeft: 6, fontSize: 10 }}>เกินกำหนด</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {c.bills} บิล{c.earliestDue ? ` · ครบกำหนดเร็วสุด ${db.thaiDate(c.earliestDue)}` : ''}
                      </div>
                    </div>
                    <span className="mono" style={{ fontWeight: 700, color: c.isOverdue ? 'var(--red)' : 'var(--primary)', flexShrink: 0 }}>
                      {db.thb(c.total)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '11px 18px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted" style={{ fontSize: 12.5 }}>ยอดค้างชำระรวม</span>
                <div className="spacer" />
                <span className="mono" style={{ fontWeight: 800, color: 'var(--primary)' }}>{db.thb(totalCreditorDebt)}</span>
              </div>
              <div style={{ padding: '0 18px 14px' }}>
                <button className="btn sm primary" style={{ width: '100%' }} onClick={() => setActive('expenses.finance')}>
                  ไปชำระเงิน
                </button>
              </div>
            </div>
          )}

          {/* Vehicle Registrations */}
          <div className="card">
            <div className="head">
              <h3>ต่อทะเบียน / ภาษีรถ</h3>
              {renewals.length > 0 && <span className="badge amber mono">{renewals.length}</span>}
            </div>
            <div style={{ padding: '10px 0 6px' }}>
              {renewals.length === 0 && (
                <div className="empty" style={{ padding: '28px 18px' }}>ไม่มีเอกสารใกล้หมดอายุใน 60 วัน ✅</div>
              )}
              {renewals.map(reg => {
                const isCritical = reg.status === 'critical'
                return (
                  <div
                    key={reg.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '11px 18px 11px 14px',
                      borderLeft: `3px solid ${isCritical ? '#EF4444' : '#F59E0B'}`,
                      marginLeft: 18, marginBottom: 8,
                      background: isCritical ? '#FEF2F2' : '#FFFBEB',
                      borderRadius: '0 8px 8px 0', gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {reg.plate}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12, marginLeft: 5 }}>({reg.label})</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {reg.type} · หมดอายุ {reg.dueDate}
                      </div>
                    </div>
                    <button
                      className={`btn sm ${isCritical ? 'danger solid' : 'primary'}`}
                      style={{ flexShrink: 0 }}
                      onClick={() => setRegModal(reg)}
                    >
                      {isCritical ? '⚠️ ต่อด่วน' : 'ต่อเลย'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        {canApprove ? (
          <div className="card">
            <div className="head">
              <h3>งานอนุมัติ</h3>
              {pendingRequests.length > 0 && (
                <span className="badge blue mono">{pendingRequests.length}</span>
              )}
            </div>
            <div style={{ padding: '10px 0 6px' }}>
              {pendingRequests.length === 0 ? (
                <div className="empty" style={{ padding: '28px 18px' }}>ไม่มีรายการรออนุมัติ ✅</div>
              ) : pendingRequests.map(req => {
                const pColor = P_COLOR[req.priority]
                const pBg    = P_BG[req.priority]
                return (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start',
                      padding: '10px 18px 10px 14px',
                      borderLeft: `3px solid ${pColor}`,
                      marginLeft: 18, marginBottom: 8,
                      background: pBg, borderRadius: '0 8px 8px 0', gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {req.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{req.desc}</div>
                      <div style={{ fontSize: 10.5, color: pColor, fontWeight: 600, marginTop: 4 }}>
                        {P_LABEL[req.priority]} · {req.time}ที่แล้ว
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
                      <button
                        style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setActive('alerts')}
                        title="ไปที่หน้าอนุมัติเพื่อพิจารณา"
                      >
                        พิจารณา →
                      </button>
                      <button
                        style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setDismissedReqs(prev => new Set([...prev, req.id]))}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="head"><h3>กิจกรรมล่าสุด</h3></div>
            <div style={{ padding: '8px 18px' }}>
              <div className="feed">
                {activity.slice(0, 6).map(a => (
                  <div className="feed-item" key={a.id}>
                    <div className={`ic ${colorMap[a.type] || ''}`}>
                      <Icon name={iconMap[a.type] || 'circle'} size={15} />
                    </div>
                    <div className="body">
                      <div className="who">{a.who}</div>
                      <div className="txt">{a.text}</div>
                      <div className="when">{a.at.slice(11)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Trips — full width */}
      <div className="card">
        <div className="head">
          <h3>งานขนส่งที่กำลังดำเนินการ</h3>
          <div className="right">
            <button className="btn sm" onClick={() => setActive('dispatch')}>
              ดูทั้งหมด <Icon name="arrow-right" size={13} />
            </button>
          </div>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัสงาน</th>
                <th>เส้นทาง</th>
                <th>ลูกค้า</th>
                <th>คนขับ / รถ</th>
                <th>สถานะ</th>
                <th className="right">ความคืบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {onTrip.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    ไม่มีงานขนส่งที่กำลังดำเนินการ
                  </td>
                </tr>
              ) : onTrip.map(t => {
                const cu = customers.find(c => c.id === t.customerId)
                const dr = employees.find(e => e.id === t.driverId)
                const v  = vehicles.find(v => v.id === t.vehicleId)
                return (
                  <tr key={t.id}>
                    <td><span className="mono" style={{ fontWeight: 600 }}>{t.code}</span></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{db.originOf(t)}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>→ {db.destOf(t)}</div>
                    </td>
                    <td>{cu?.name?.replace('บริษัท ', '').replace(' จำกัด', '') || '—'}</td>
                    <td>
                      <div style={{ fontSize: 12.5 }}>{dr?.name || '—'}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{v?.plate || '—'}</div>
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="right" style={{ minWidth: 140 }}>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <div className="progress" style={{ width: 80 }}>
                          <div className="fill" style={{ width: t.progress + '%' }} />
                        </div>
                        <span className="mono" style={{ fontSize: 12, minWidth: 32 }}>{t.progress}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {regModal      && <RegistrationModal reg={regModal}    onClose={() => setRegModal(null)} />}
      {approvalModal && <ApprovalModal     req={approvalModal} onClose={() => setApprovalModal(null)} />}
      {showExport    && (
        <ExportReportsModal
          role={user.role}
          onPick={id => { setShowExport(false); setActive(id) }}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}

// ─── Export Reports shortcut ───────────────────────────────────────────────────
const REPORT_GROUPS: { title: string; reports: { id: string; label: string; desc: string; icon: string }[] }[] = [
  {
    title: 'งานขนส่ง',
    reports: [
      { id: 'dispatch.report',  label: 'รายงานสรุปงานขนส่ง',     desc: 'KPI ต่อรอบ + แบบฟอร์มรายเที่ยว · พิมพ์ PDF', icon: 'chart' },
      { id: 'dispatch.monthly', label: 'รายงานรายเดือน',          desc: 'สรุปงานขนส่งแยกตามเดือน',                  icon: 'calendar' },
      { id: 'dispatch.vehicleMonthly', label: 'สรุปรายเที่ยวรายเดือน (ต่อคัน)', desc: 'พิมพ์รายเที่ยวต่อทะเบียน · นับตามวันเปิดงาน', icon: 'calendar' },
      { id: 'dispatch.history', label: 'ประวัติการวิ่งงาน',       desc: 'ดูประวัติงานทั้งหมด',                       icon: 'history' },
    ],
  },
  {
    title: 'น้ำมัน',
    reports: [
      { id: 'fuel.report',  label: 'รายงานน้ำมันรายเดือน', desc: 'การใช้น้ำมันแยกตามเดือน/รถ', icon: 'chart' },
      { id: 'fuel.summary', label: 'สรุปคลังน้ำมันรวม',     desc: 'สต๊อกคลังน้ำมัน + รับเข้า/จ่ายออก', icon: 'package' },
    ],
  },
  {
    title: 'ค่าใช้จ่าย',
    reports: [
      { id: 'expenses.report',  label: 'รายงานสรุปค่าใช้จ่าย', desc: 'ค่าใช้จ่ายแยกตามหมวด/รถ/ช่วงเวลา',     icon: 'chart' },
      { id: 'expenses.finance', label: 'สถานะการเงิน',         desc: 'ยอดค้างจ่าย/ครบกำหนดของค่าใช้จ่าย',    icon: 'money' },
    ],
  },
  {
    title: 'การเงิน',
    reports: [
      { id: 'finance', label: 'P&L รายคัน', desc: 'กำไร/ขาดทุนต่อรถ', icon: 'chart' },
    ],
  },
  {
    title: 'ยาง',
    reports: [
      { id: 'tires.history',   label: 'ประวัติยางรายเส้น', desc: 'ค้นและดูประวัติยางรายเส้น', icon: 'history' },
      { id: 'tires.scrapped',  label: 'ยางหมดสภาพ',        desc: 'รายการยางที่หมดสภาพ + ขายซาก', icon: 'trash' },
    ],
  },
]

function ExportReportsModal({
  role, onPick, onClose,
}: {
  role: 'admin' | 'manager' | 'driver'
  onPick: (id: string) => void
  onClose: () => void
}) {
  const visibleGroups = REPORT_GROUPS
    .map(g => ({ ...g, reports: g.reports.filter(r => canAccessRoute(r.id, role)) }))
    .filter(g => g.reports.length > 0)

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="head">
          <h3>เลือกรายงานที่ต้องการดู/พิมพ์</h3>
        </div>
        <div className="body">
          {visibleGroups.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>ไม่มีรายงานที่บัญชีของคุณเข้าถึงได้</div>
          ) : visibleGroups.map(group => (
            <div key={group.title} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                {group.title}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {group.reports.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onPick(r.id)}
                    style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: 10,
                      border: '1px solid var(--line)', background: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-50)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = '#fff' }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: 'var(--primary-50)', color: 'var(--primary)',
                      display: 'grid', placeItems: 'center',
                    }}>
                      <Icon name={r.icon} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{r.label}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{r.desc}</div>
                    </div>
                    <Icon name="chevron-right" size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  )
}
