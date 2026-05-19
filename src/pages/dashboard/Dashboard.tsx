import { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import type { User, Vehicle, Employee, Dispatch, Tire, Expense, ActivityLog, StockItem, Customer, SubJob } from '../../types'
import { Icon, StatusBadge } from '../../components/ui'

// ─── Mock data ─────────────────────────────────────────────────────────────────
interface RegItem {
  id: number; plate: string; label: string; type: string; dueDate: string; status: 'warning' | 'critical'
}
interface ReqItem {
  id: number; title: string; desc: string; time: string; priority: 'critical' | 'warning' | 'info'
}

const MOCK_REGISTRATIONS: RegItem[] = [
  { id: 1, plate: '70-2451', label: 'RR2', type: 'ต่อภาษีรถ', dueDate: '28 พ.ค. 69', status: 'warning' },
  { id: 2, plate: '70-4567', label: 'FL2', type: 'ต่อประกันภัยรถ', dueDate: '15 มิ.ย. 69', status: 'warning' },
  { id: 3, plate: '70-7890', label: 'RR5', type: 'ต่อใบขับขี่', dueDate: 'วันนี้ ⚠️', status: 'critical' },
]

const MOCK_EMP_REQUESTS: ReqItem[] = [
  { id: 1, title: 'ขอเปลี่ยนยาง - สนาม ด.', desc: 'ยาง 4 เส้น รถ 70-2451', time: '2 ชม.', priority: 'critical' },
  { id: 2, title: 'ขอ OT ไปกลับ - วิทย์ น.', desc: 'เพิ่มเวลา 4 ชม.', time: '30 นาที', priority: 'warning' },
  { id: 3, title: 'ขออาหารเสริม - บุญส่วน ร.', desc: 'ขอเบี้ยเลี้ยง 300 บาท', time: '1.5 ชม.', priority: 'info' },
  { id: 4, title: 'ขอวันลา - สมศรี', desc: 'ลาป่วย 1 วัน', time: '45 นาที', priority: 'warning' },
  { id: 5, title: 'ขอแก้เลขบัญชี - ณัฐ พ.', desc: 'เปลี่ยนบัญชีโอน', time: '3.5 ชม.', priority: 'info' },
]

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
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const sectionStyle = { background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }
  const sectionLabel = { fontSize: 11, fontWeight: 700 as const, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 12 }
  const inputStyle = { width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' as const, background: '#fff' }
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', display: 'block' as const, marginBottom: 5 }

  const save = () => {
    if (!form.cost || !form.date) return
    setSaving(true)
    db.add('vehicleRegistrations', {
      id: uid('vreg'),
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
      createdAt: new Date().toISOString(),
    })
    setSaving(false)
    onClose()
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
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const pColor = P_COLOR[req.priority]
  const pBg    = P_BG[req.priority]

  const save = () => {
    setSaving(true)
    db.add('requestApprovals', {
      id: uid('ra'),
      requestId: req.id,
      title: req.title,
      status: form.status,
      notes: form.notes,
      autoUpdate: form.autoUpdate,
      updateData: form.updateData,
      approvedAt: new Date().toISOString(),
    })
    setSaving(false)
    onClose()
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

  const vehicles  = db.getAll<Vehicle>('vehicles')
  const employees = db.getAll<Employee>('employees')
  const dispatch  = db.getAll<Dispatch>('dispatch')
  const customers = db.getAll<Customer>('customers')
  const tires     = db.getAll<Tire>('tires')
  const expenses  = db.getAll<Expense>('expenses')
  const activity  = db.getAll<ActivityLog>('activity')
  const stock     = db.getAll<StockItem>('stock')
  const subJobs   = db.getAll<SubJob>('subJobs')

  const subUnpaid      = useMemo(() => subJobs.filter(j => j.status === 'unpaid'), [subJobs])
  const subUnpaidTotal = useMemo(() => subUnpaid.reduce((s, j) => s + (j.total || 0), 0), [subUnpaid])

  const onTrip    = useMemo(() => dispatch.filter(t => t.status === 'in-progress'), [dispatch])
  const scheduled = useMemo(() => dispatch.filter(t => t.status === 'scheduled'), [dispatch])
  const delivered = useMemo(() => dispatch.filter(t => t.status === 'completed'), [dispatch])

  const revenueThisMonth = useMemo(() => dispatch.reduce((s, t) => s + db.amountOf(t), 0), [dispatch])
  const costThisMonth    = useMemo(
    () => dispatch.reduce((s, t) => s + (t.cost || 0), 0) + expenses.reduce((s, x) => s + (x.amount || 0), 0),
    [dispatch, expenses],
  )

  const idleVehicles        = vehicles.filter(v => v.status === 'available').length
  const activeVehicles      = vehicles.filter(v => v.status === 'on-trip').length
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length
  const tireAlerts          = tires.filter(t => (t.status as string) === 'critical').length
  const lowStock            = stock.filter(s => s.qty <= s.reorderAt).length

  const marginPct = revenueThisMonth > 0
    ? Math.round(((revenueThisMonth - costThisMonth) / revenueThisMonth) * 100) : 0

  const canApprove    = user.role === 'admin' || user.role === 'manager'
  const pendingRequests = MOCK_EMP_REQUESTS.filter(r => !dismissedReqs.has(r.id))

  const iconMap:  Record<string, string> = { trip: 'package', alert: 'alert', create: 'plus', approve: 'check', invoice: 'money', fuel: 'fuel' }
  const colorMap: Record<string, string> = { alert: 'red', approve: 'green', fuel: 'amber' }

  const todayLabel = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  // KPI card definitions
  const kpiCards = [
    {
      label: 'รายได้เดือนนี้', value: db.thb(revenueThisMonth), unit: '',
      delta: '+12.4% จากเดือนก่อน', deltaUp: true as boolean | null,
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
          <button className="btn primary">
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
              <span className="badge red mono">{tireAlerts + lowStock + 1 + subUnpaid.length}</span>
            </div>
            <div style={{ padding: '8px 18px' }}>
              <div className="feed">
                <div className="feed-item">
                  <div className="ic red"><Icon name="alert" size={16} /></div>
                  <div className="body">
                    <div className="who">ยางวิกฤติ {tireAlerts} เส้น</div>
                    <div className="txt">รถ 70-2451 (RR2) และ 70-4029 (FR) ต่ำกว่าเกณฑ์</div>
                    <div className="when">8 ชม.ที่แล้ว</div>
                  </div>
                </div>
                <div className="feed-item">
                  <div className="ic amber"><Icon name="wrench" size={16} /></div>
                  <div className="body">
                    <div className="who">ครบกำหนดบำรุงรักษา</div>
                    <div className="txt">รถ 70-7890 ครบ 10,000 km</div>
                    <div className="when">วันนี้</div>
                  </div>
                </div>
                <div className="feed-item">
                  <div className="ic amber"><Icon name="package" size={16} /></div>
                  <div className="body">
                    <div className="who">สต็อคใกล้หมด {lowStock} รายการ</div>
                    <div className="txt">หลอดไฟหน้า H4, ผ้าเบรกหน้า</div>
                    <div className="when">เมื่อวาน</div>
                  </div>
                </div>
                <div className="feed-item">
                  <div className="ic"><Icon name="money" size={16} /></div>
                  <div className="body">
                    <div className="who">ลูกหนี้เกินกำหนด</div>
                    <div className="txt">PTT Global Chemical ฿1.24M (30+ วัน)</div>
                    <div className="when">3 วันที่แล้ว</div>
                  </div>
                </div>
                {subUnpaid.length > 0 && (
                  <div className="feed-item" style={{ cursor: 'pointer' }} onClick={() => setActive('subcontractors.history')}>
                    <div className="ic amber"><Icon name="truck" size={16} /></div>
                    <div className="body">
                      <div className="who">รถรับจ้าง รอชำระเงิน {subUnpaid.length} งาน</div>
                      <div className="txt">ยอดรวม {db.thb(subUnpaidTotal)}</div>
                      <div className="when">คลิกเพื่อชำระ</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle Registrations */}
          <div className="card">
            <div className="head">
              <h3>ต่อทะเบียน / ภาษีรถ</h3>
              <span className="badge amber mono">{MOCK_REGISTRATIONS.length}</span>
            </div>
            <div style={{ padding: '10px 0 6px' }}>
              {MOCK_REGISTRATIONS.map(reg => {
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
                      style={{
                        background: isCritical ? '#EF4444' : '#3B82F6', color: '#fff',
                        border: 'none', borderRadius: 7, padding: '5px 14px',
                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      }}
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
                        onClick={() => setApprovalModal(req)}
                      >
                        อนุมัติ
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
    </div>
  )
}
