import { useState, useMemo, useRef, useEffect } from 'react'
import { db } from '../../lib/db'
import { can, roleLabel } from '../../lib/permissions'
import type { Vehicle, Employee, User, EditApprovalRequest, VehicleChangeField } from '../../types'
import { Icon, StatusBadge, Field } from '../../components/ui'

interface VehiclesPageProps {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
  user: User
}

interface FilterStatus {
  available: boolean
  maintenance: boolean
  unavailable: boolean
}

interface DocWarning {
  text: string
  color: string
}

interface CheckOption {
  k: string
  l: string
  color?: string
}

interface FilterCheckGroupProps {
  label: string
  options: CheckOption[]
  state: Record<string, boolean>
  onChange: (s: Record<string, boolean>) => void
}

function FilterCheckGroup({ label, options, state, onChange }: FilterCheckGroupProps) {
  return (
    <div className="row" style={{ gap: 14, alignItems: 'center' }}>
      <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>{label}:</span>
      {options.map(o => (
        <label key={o.k} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={!!state[o.k]}
            onChange={() => onChange({ ...state, [o.k]: !state[o.k] })}
            style={{ accentColor: o.color || 'var(--primary)' }}
          />
          <span style={{ color: o.color || 'var(--text-2)', fontWeight: 500 }}>{o.l}</span>
        </label>
      ))}
    </div>
  )
}

const TODAY = '2026-05-17'

function daysTo(s: string): number | null {
  if (!s) return null
  const d = new Date(s)
  const today = new Date(TODAY)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function docWarn(v: Vehicle): DocWarning | null {
  const keys: (keyof Vehicle)[] = ['tax', 'insurance', 'dispatchPermit']
  const dts = keys
    .map(k => ({ k, d: daysTo(String(v[k] ?? '')) }))
    .filter((x): x is { k: keyof Vehicle; d: number } => x.d !== null && x.d <= 60)

  if (!dts.length) return null
  const sorted = dts.sort((a, b) => a.d - b.d)
  const min = sorted[0]
  const labels: Record<string, string> = { tax: 'ภาษี', insurance: 'ประกัน', dispatchPermit: 'ใบอนุญาต' }
  if (min.d < 0) return { text: `${labels[String(min.k)]}: หมดอายุแล้ว`, color: 'var(--red)' }
  return {
    text: `${labels[String(min.k)]}: ${min.d} วัน`,
    color: min.d <= 30 ? 'var(--red)' : 'var(--amber)',
  }
}

const VEHICLE_TYPES = ['4ล้อ', '6ล้อ', '10ล้อ', '18ล้อ', '22ล้อ', 'ตู้คอนเทนเนอร์', 'พ่วงข้าง']

interface VehicleEditForm {
  plate: string
  brand: string
  year: string
  type: string
  customType: string
  status: Vehicle['status']
  driverId: string
  odometer: string
  nextServiceKm: string
  fuel: string
  purchaseDate: string
  lastService: string
  nextService: string
  tax: string
  insurance: string
  dispatchPermit: string
}

function buildChangeFields(before: Vehicle, after: VehicleEditForm): VehicleChangeField[] {
  const out: VehicleChangeField[] = []
  const effectiveType = after.type === 'อื่นๆ' ? (after.customType.trim() || 'อื่นๆ') : after.type

  if (after.plate !== before.plate)
    out.push({ key: 'plate', label: 'ทะเบียน', before: before.plate, after: after.plate })
  if (after.brand !== before.brand)
    out.push({ key: 'brand', label: 'ยี่ห้อ/รุ่น', before: before.brand, after: after.brand })
  if (after.year !== String(before.year))
    out.push({ key: 'year', label: 'ปี', before: String(before.year), after: after.year })
  if (effectiveType !== before.type)
    out.push({ key: 'type', label: 'ประเภทรถ', before: before.type, after: effectiveType })
  if (after.status !== before.status)
    out.push({ key: 'status', label: 'สถานะรถ', before: before.status, after: after.status })
  if ((after.driverId || '') !== (before.driverId || ''))
    out.push({ key: 'driverId', label: 'คนขับ', before: before.driverId || '—', after: after.driverId || '—' })
  const od = Number(after.odometer)
  if (!isNaN(od) && od !== before.odometer)
    out.push({ key: 'odometer', label: 'เลขไมล์', before: db.fmt(before.odometer), after: db.fmt(od) })
  const nsk = Number(after.nextServiceKm)
  if (!isNaN(nsk) && nsk !== (before.nextServiceKm || 0))
    out.push({ key: 'nextServiceKm', label: 'ระยะทางซ่อมถัดไป', before: db.fmt(before.nextServiceKm || 0), after: db.fmt(nsk) })
  const fu = Number(after.fuel)
  if (!isNaN(fu) && fu !== before.fuel)
    out.push({ key: 'fuel', label: 'ระดับน้ำมัน (%)', before: String(before.fuel), after: String(fu) })
  if ((after.purchaseDate || '') !== (before.purchaseDate || ''))
    out.push({ key: 'purchaseDate', label: 'วันที่ซื้อรถ', before: before.purchaseDate || '—', after: after.purchaseDate || '—' })
  if ((after.lastService || '') !== (before.lastService || ''))
    out.push({ key: 'lastService', label: 'ซ่อมล่าสุด', before: before.lastService || '—', after: after.lastService || '—' })
  if ((after.nextService || '') !== (before.nextService || ''))
    out.push({ key: 'nextService', label: 'นัดซ่อมครั้งถัดไป', before: before.nextService || '—', after: after.nextService || '—' })
  if ((after.tax || '') !== (before.tax || ''))
    out.push({ key: 'tax', label: 'วันหมดอายุภาษี', before: before.tax || '—', after: after.tax || '—' })
  if ((after.insurance || '') !== (before.insurance || ''))
    out.push({ key: 'insurance', label: 'วันหมดอายุประกัน', before: before.insurance || '—', after: after.insurance || '—' })
  if ((after.dispatchPermit || '') !== (before.dispatchPermit || ''))
    out.push({ key: 'dispatchPermit', label: 'วันหมดอายุใบอนุญาต', before: before.dispatchPermit || '—', after: after.dispatchPermit || '—' })
  return out
}

function buildPatch(before: Vehicle, after: VehicleEditForm): Partial<Vehicle> {
  const patch: Partial<Vehicle> = {}
  const effectiveType = after.type === 'อื่นๆ' ? (after.customType.trim() || 'อื่นๆ') : after.type
  if (after.plate !== before.plate) patch.plate = after.plate
  if (after.brand !== before.brand) patch.brand = after.brand
  const yr = Number(after.year)
  if (!isNaN(yr) && yr !== before.year) patch.year = yr
  if (effectiveType !== before.type) patch.type = effectiveType
  if (after.status !== before.status) patch.status = after.status
  if ((after.driverId || null) !== before.driverId) patch.driverId = after.driverId || null
  const od = Number(after.odometer)
  if (!isNaN(od) && od !== before.odometer) patch.odometer = od
  const nsk = Number(after.nextServiceKm)
  if (!isNaN(nsk) && nsk !== (before.nextServiceKm || 0)) patch.nextServiceKm = nsk
  const fu = Number(after.fuel)
  if (!isNaN(fu) && fu !== before.fuel) patch.fuel = fu
  if ((after.purchaseDate || '') !== (before.purchaseDate || '')) patch.purchaseDate = after.purchaseDate
  if ((after.lastService || '') !== (before.lastService || '')) patch.lastService = after.lastService
  if ((after.nextService || '') !== (before.nextService || '')) patch.nextService = after.nextService
  if ((after.tax || '') !== (before.tax || '')) patch.tax = after.tax
  if ((after.insurance || '') !== (before.insurance || '')) patch.insurance = after.insurance
  if ((after.dispatchPermit || '') !== (before.dispatchPermit || '')) patch.dispatchPermit = after.dispatchPermit
  return patch
}

interface EditModalProps {
  vehicle: Vehicle
  user: User
  mode: 'edit' | 'request'
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

function VehicleEditModal({ vehicle, user, mode, onClose, onSuccess, onError }: EditModalProps) {
  const employees = db.getAll<Employee>('employees')
  const isCustomType = !VEHICLE_TYPES.includes(vehicle.type)
  const [form, setForm] = useState<VehicleEditForm>({
    plate: vehicle.plate,
    brand: vehicle.brand,
    year: String(vehicle.year),
    type: isCustomType ? 'อื่นๆ' : vehicle.type,
    customType: isCustomType ? vehicle.type : '',
    status: vehicle.status,
    driverId: vehicle.driverId ?? '',
    odometer: String(vehicle.odometer),
    nextServiceKm: String(vehicle.nextServiceKm || ''),
    fuel: String(vehicle.fuel),
    purchaseDate: vehicle.purchaseDate || '',
    lastService: vehicle.lastService || '',
    nextService: vehicle.nextService || '',
    tax: vehicle.tax || '',
    insurance: vehicle.insurance || '',
    dispatchPermit: vehicle.dispatchPermit || '',
  })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof VehicleEditForm>(k: K, v: VehicleEditForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const availableDrivers = employees.filter(
    e => e.position === 'คนขับ' && (!e.vehicleId || e.vehicleId === vehicle.id),
  )

  const submit = () => {
    if (saving) return
    if (!form.plate.trim() || !form.brand.trim()) {
      onError('กรุณากรอกทะเบียนและยี่ห้อ')
      return
    }
    setSaving(true)
    try {
      const changeFields = buildChangeFields(vehicle, form)
      if (changeFields.length === 0) throw new Error('ไม่มีการเปลี่ยนแปลง')
      const patch = buildPatch(vehicle, form)

      if (mode === 'edit') {
        db.update<Vehicle>('vehicles', vehicle.id, patch)
        onSuccess('บันทึกการแก้ไขเรียบร้อย')
        return
      }

      if (!reason.trim()) throw new Error('กรุณาระบุเหตุผลในการขอแก้ไข')
      db.add<Partial<EditApprovalRequest>>('editApprovals', {
        requesterId: user.id,
        requesterName: user.name,
        requesterRole: user.role,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        reason: reason.trim(),
        changes: patch,
        changeFields,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        reviewerId: null,
        reviewerName: null,
        reviewedAt: null,
        reviewNote: '',
      })
      onSuccess('ส่งคำขอแก้ไขเรียบร้อย รอการอนุมัติจากผู้จัดการ')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          width: '95%',
          maxWidth: 700,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>
            {mode === 'edit' ? 'แก้ไขข้อมูลรถ' : 'ขออนุมัติแก้ไขข้อมูลรถ'}
          </h2>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{vehicle.plate}</span>
            {' · '}{vehicle.brand} · {vehicle.type}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section 1: ข้อมูลทั่วไป */}
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--primary)' }}><Icon name="truck" size={16} /></span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>ข้อมูลทั่วไป</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="ทะเบียนรถ *">
                <input value={form.plate} onChange={e => set('plate', e.target.value)} placeholder="เช่น ABC-1234" />
              </Field>
              <Field label="ยี่ห้อ *">
                <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="เช่น Isuzu, Hino" />
              </Field>
              <Field label="รุ่น / ปี">
                <input value={form.year} onChange={e => set('year', e.target.value)} placeholder="เช่น FVR 2018" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: form.type === 'อื่นๆ' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
              <Field label="ประเภทรถ *">
                <select value={form.type} onChange={e => set('type', e.target.value)}>
                  {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                  <option value="อื่นๆ">อื่นๆ (กำหนดเอง)</option>
                </select>
              </Field>
              {form.type === 'อื่นๆ' && (
                <Field label="ระบุประเภทรถ *">
                  <input value={form.customType} onChange={e => set('customType', e.target.value)} placeholder="เช่น รถพ่วง 18ล้อ" />
                </Field>
              )}
              <Field label="สถานะรถ">
                <select value={form.status} onChange={e => set('status', e.target.value as Vehicle['status'])}>
                  <option value="available">พร้อมใช้งาน</option>
                  <option value="on-trip">ออกงาน</option>
                  <option value="maintenance">ซ่อมบำรุง</option>
                  <option value="warning">เฝ้าระวัง</option>
                </select>
              </Field>
              <Field label="คนขับประจำรถ">
                <select value={form.driverId} onChange={e => set('driverId', e.target.value)}>
                  <option value="">-- ยังไม่ระบุ --</option>
                  {availableDrivers.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Section 2: ข้อมูลระยะทาง */}
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--primary)' }}><Icon name="gauge" size={16} /></span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>ข้อมูลระยะทาง</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="เลขไมล์ปัจจุบัน (km)">
                <input type="number" value={form.odometer} onChange={e => set('odometer', e.target.value)} />
              </Field>
              <Field label="ระยะทางซ่อมครั้งถัดไป (km)">
                <input type="number" value={form.nextServiceKm} onChange={e => set('nextServiceKm', e.target.value)} placeholder="เช่น 10000" />
              </Field>
              <Field label="ระดับน้ำมัน (%)">
                <input type="number" min="0" max="100" value={form.fuel} onChange={e => set('fuel', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Section 3: เอกสาร & วันหมดอายุ */}
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--primary)' }}><Icon name="calendar" size={16} /></span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>เอกสาร &amp; วันหมดอายุ</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="วันที่ซื้อรถ">
                <input type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
              </Field>
              <Field label="ซ่อมบำรุงล่าสุด">
                <input type="date" value={form.lastService} onChange={e => set('lastService', e.target.value)} />
              </Field>
              <Field label="นัดซ่อมครั้งถัดไป">
                <input type="date" value={form.nextService} onChange={e => set('nextService', e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="วันหมดอายุภาษี">
                <input type="date" value={form.tax} onChange={e => set('tax', e.target.value)} />
              </Field>
              <Field label="วันหมดอายุประกันภัย">
                <input type="date" value={form.insurance} onChange={e => set('insurance', e.target.value)} />
              </Field>
              <Field label="วันหมดอายุใบอนุญาต">
                <input type="date" value={form.dispatchPermit} onChange={e => set('dispatchPermit', e.target.value)} />
              </Field>
            </div>
          </div>

          {mode === 'request' && (
            <div>
              <Field label="เหตุผลที่ขอแก้ไข *">
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  placeholder="เช่น อัปเดตเลขไมล์หลังจบทริป"
                  style={{ resize: 'vertical', minHeight: 48 }}
                />
              </Field>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                คำขอจะถูกส่งให้ผู้จัดการพิจารณาก่อนการเปลี่ยนแปลงจะมีผล
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
          <div className="row btn-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose} disabled={saving}>
              <Icon name="close" size={15} /> ยกเลิก
            </button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : (mode === 'edit' ? 'บันทึก' : 'ส่งคำขอ')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, message, confirmLabel, destructive, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          width: '90%',
          maxWidth: 420,
          padding: 24,
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: 17, fontWeight: 600 }}>{title}</h2>
        <p style={{ margin: '0 0 22px 0', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.55 }}>
          {message}
        </p>
        <div className="row btn-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>
            <Icon name="close" size={15} /> ยกเลิก
          </button>
          <button
            className={`btn ${destructive ? 'danger solid' : 'primary'}`}
            onClick={onConfirm}
          >
            <Icon name={destructive ? 'close' : 'check'} size={15} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ToastState {
  kind: 'success' | 'error'
  msg: string
}

interface ToastProps {
  toast: ToastState
  onClose: () => void
}

function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, toast.kind === 'success' ? 2800 : 4000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  const isSuccess = toast.kind === 'success'
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1200,
        background: isSuccess ? '#16a34a' : '#A32D2D',
        color: '#fff',
        padding: '12px 18px',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        fontSize: 14,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 280,
        maxWidth: 420,
        animation: 'kpsToastIn .25s ease-out',
      }}
    >
      <span style={{ fontSize: 18 }}>{isSuccess ? '✅' : '⚠️'}</span>
      <span style={{ flex: 1 }}>{toast.msg}</span>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 16,
          padding: 0,
          opacity: 0.85,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

interface RowActionMenuProps {
  user: User
  pendingForVehicle: boolean
  onClose: () => void
  onEdit: () => void
  onRequest: () => void
  onDelete: () => void
}

function RowActionMenu({ user, pendingForVehicle, onClose, onEdit, onRequest, onDelete }: RowActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const canEdit = can.editVehicle(user.role)
  const canDelete = can.deleteVehicle(user.role)
  const canRequest = can.requestVehicleEdit(user.role)

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        zIndex: 100,
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,.15)',
        minWidth: 200,
        padding: '4px 0',
      }}
    >
      {canEdit && (
        <button
          className="btn ghost"
          style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13 }}
          onClick={() => {
            onClose()
            onEdit()
          }}
        >
          <Icon name="edit" size={14} /> แก้ไขข้อมูลรถ
        </button>
      )}
      {canRequest && (
        <button
          className="btn ghost"
          disabled={pendingForVehicle}
          style={{
            width: '100%',
            borderRadius: 0,
            justifyContent: 'flex-start',
            padding: '8px 14px',
            fontSize: 13,
            color: pendingForVehicle ? 'var(--text-faint)' : 'var(--primary)',
          }}
          onClick={() => {
            onClose()
            if (!pendingForVehicle) onRequest()
          }}
        >
          <Icon name="bell" size={14} />
          {pendingForVehicle ? ' รออนุมัติอยู่' : ' ขออนุมัติแก้ไข'}
        </button>
      )}
      {canDelete && (
        <>
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
          <button
            className="btn ghost"
            style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: '#A32D2D' }}
            onClick={() => {
              onClose()
              onDelete()
            }}
          >
            <Icon name="close" size={14} /> ลบข้อมูลรถ
          </button>
        </>
      )}
      {!canEdit && !canRequest && !canDelete && (
        <div className="muted" style={{ padding: '10px 14px', fontSize: 12 }}>
          ไม่มีสิทธิ์ดำเนินการ
        </div>
      )}
    </div>
  )
}

export function VehiclesPage({ setActive, setSubject, user }: VehiclesPageProps) {
  const [tick, setTick] = useState(0)
  const vehicles = useMemo(() => db.getAll<Vehicle>('vehicles'), [tick])
  const employees = db.getAll<Employee>('employees')
  const approvals = useMemo(() => db.getAll<EditApprovalRequest>('editApprovals'), [tick])
  const vehicleTypes = useMemo(() => {
    const types = [...new Set(vehicles.map(v => v.type))].sort()
    return ['ทั้งหมด', ...types]
  }, [vehicles])
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>({
    available: true,
    maintenance: true,
    unavailable: true,
  })
  const [filterType, setFilterType] = useState<string>('ทั้งหมด')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<{ vehicle: Vehicle; mode: 'edit' | 'request' } | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const pendingByVehicle = useMemo(() => {
    const set = new Set<string>()
    approvals.forEach(a => {
      if (a.status === 'pending' && a.requesterId === user.id) set.add(a.vehicleId)
    })
    return set
  }, [approvals, user.id])

  const inStatusBucket = (v: Vehicle): boolean => {
    if (v.status === 'available') return filterStatus.available
    if (v.status === 'maintenance') return filterStatus.maintenance
    return filterStatus.unavailable
  }

  const inTypeBucket = (v: Vehicle): boolean => {
    if (filterType === 'ทั้งหมด') return true
    return v.type === filterType
  }

  const filtered = useMemo(() => {
    return vehicles.filter(v => {
      if (
        q &&
        !v.plate.toLowerCase().includes(q.toLowerCase()) &&
        !v.brand.toLowerCase().includes(q.toLowerCase()) &&
        !v.type.includes(q)
      )
        return false
      if (!inStatusBucket(v)) return false
      if (!inTypeBucket(v)) return false
      return true
    })
  }, [vehicles, q, filterStatus, filterType])

  const confirmDelete = (v: Vehicle) => {
    try {
      const fresh = db.get<Vehicle>('vehicles', v.id)
      if (!fresh) throw new Error('ไม่พบรถในระบบ')
      db.remove('vehicles', v.id)
      setDeletingVehicle(null)
      setTick(t => t + 1)
      setToast({ kind: 'success', msg: `ลบรถ ${v.plate} เรียบร้อย` })
    } catch (err) {
      setToast({ kind: 'error', msg: err instanceof Error ? err.message : 'ลบไม่สำเร็จ' })
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายการรถ</h1>
          <div className="page-sub">
            สิทธิ์ของคุณ: <strong style={{ color: 'var(--text-1)' }}>{roleLabel(user.role)}</strong>
            {can.editVehicle(user.role) ? ' · แก้ไขข้อมูลได้' : ' · ต้องขออนุมัติก่อนแก้ไข'}
            {can.deleteVehicle(user.role) && ' · ลบได้'}
          </div>
        </div>
        <div className="actions">
          {can.editVehicle(user.role) && (
            <button className="btn primary" onClick={() => setActive('vehicles.add')}>
              <Icon name="plus" size={15} /> เพิ่มรถใหม่
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Icon
              name="search"
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
              }}
            />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ค้นหาตามทะเบียน / ยี่ห้อ / สถานะ"
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px 0 36px',
                border: '1px solid var(--line)',
                borderRadius: 8,
                background: 'var(--bg)',
                fontSize: 13,
              }}
            />
          </div>
          <FilterCheckGroup
            label="สถานะ"
            options={[
              { k: 'available', l: 'พร้อม', color: 'var(--green)' },
              { k: 'maintenance', l: 'ซ่อม', color: 'var(--amber)' },
              { k: 'unavailable', l: 'ไม่พร้อม', color: 'var(--red)' },
            ]}
            state={filterStatus as unknown as Record<string, boolean>}
            onChange={s => setFilterStatus(s as unknown as FilterStatus)}
          />
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>ประเภท:</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ height: 34, padding: '0 28px 0 10px', fontSize: 13, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 120 }}
            >
              {vehicleTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ทะเบียน</th>
                <th>ยี่ห้อ/รุ่น</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>คนขับ</th>
                <th className="right">เลขไมล์</th>
                <th>ข้อมูลหมดอายุ</th>
                <th>ดำเนิน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const dr = employees.find(e => e.id === v.driverId)
                const dw = docWarn(v)
                const pending = pendingByVehicle.has(v.id)
                return (
                  <tr
                    key={v.id}
                    onClick={() => {
                      setSubject({ type: 'vehicle', id: v.id })
                      setActive('vehicles.detail')
                    }}
                  >
                    <td>
                      <a style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">
                        {v.plate}
                      </a>
                      {pending && (
                        <div style={{ fontSize: 10.5, color: 'var(--primary)', marginTop: 2 }}>
                          <Icon name="bell" size={10} /> รออนุมัติ
                        </div>
                      )}
                    </td>
                    <td>{v.brand}</td>
                    <td>{v.type}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>{dr ? dr.name : '-'}</td>
                    <td className="num right">{db.fmt(v.odometer)}</td>
                    <td>
                      {dw ? (
                        <span style={{ color: dw.color, fontSize: 12.5 }}>{dw.text}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          className="btn ghost icon sm"
                          onClick={e => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === v.id ? null : v.id)
                          }}
                        >
                          <Icon name="more" size={16} />
                        </button>
                        {openMenuId === v.id && (
                          <RowActionMenu
                            user={user}
                            pendingForVehicle={pending}
                            onClose={() => setOpenMenuId(null)}
                            onEdit={() => setEditingVehicle({ vehicle: v, mode: 'edit' })}
                            onRequest={() => setEditingVehicle({ vehicle: v, mode: 'request' })}
                            onDelete={() => setDeletingVehicle(v)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-muted)',
            fontSize: 12.5,
          }}
        >
          <span>
            แสดง 1 ถึง {filtered.length} จากทั้งหมด {filtered.length} รายการ
          </span>
          <div className="spacer" />
          <div className="row" style={{ gap: 4 }}>
            <button className="btn sm" disabled>
              ก่อนหน้า
            </button>
            <button className="btn sm primary">1</button>
            <button className="btn sm" disabled>
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {editingVehicle && (
        <VehicleEditModal
          vehicle={editingVehicle.vehicle}
          user={user}
          mode={editingVehicle.mode}
          onClose={() => setEditingVehicle(null)}
          onSuccess={msg => {
            setEditingVehicle(null)
            setTick(t => t + 1)
            setToast({ kind: 'success', msg })
          }}
          onError={msg => setToast({ kind: 'error', msg })}
        />
      )}

      {deletingVehicle && (
        <ConfirmDialog
          title="ยืนยันการลบข้อมูลรถ"
          message={`⚠️ แน่ใจหรือว่าต้องการลบรถ ${deletingVehicle.plate}? ไม่สามารถกู้คืนได้`}
          confirmLabel="ลบ"
          destructive
          onConfirm={() => confirmDelete(deletingVehicle)}
          onCancel={() => setDeletingVehicle(null)}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
