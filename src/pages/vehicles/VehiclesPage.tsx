import { useState, useMemo, useRef, useEffect } from 'react'
import { db, uid } from '../../lib/db'
import { useList, useUpdate, useDelete, useInsert } from '../../hooks/useTable'
import { useRealtimeTable } from '../../hooks/useRealtime'
import { can } from '../../lib/permissions'
import type { Vehicle, Employee, User, EditApprovalRequest, VehicleChangeField } from '../../types'
import { Icon, StatusBadge, Field, SearchInput } from '../../components/ui'

const FIELD_LABELS: Record<string, string> = {
  plate: 'ทะเบียน', brand: 'ยี่ห้อ', year: 'ปี', type: 'ประเภท', groupKind: 'กลุ่ม',
  status: 'สถานะ', driverId: 'คนขับ', odometer: 'เลขไมล์', nextServiceKm: 'ไมล์ครบกำหนดเซอร์วิส',
  fuel: 'น้ำมัน (%)', purchaseDate: 'วันที่ซื้อ', lastService: 'เซอร์วิสล่าสุด',
  nextService: 'เซอร์วิสครั้งถัดไป', tax: 'ภาษี', insurance: 'ประกัน', dispatchPermit: 'ใบอนุญาต',
}
function buildChangeFields(before: Vehicle, after: Partial<Vehicle>): VehicleChangeField[] {
  const out: VehicleChangeField[] = []
  const beforeRec = before as unknown as Record<string, unknown>
  const afterRec = after as unknown as Record<string, unknown>
  for (const key of Object.keys(after)) {
    const b = beforeRec[key]
    const a = afterRec[key]
    if (String(b ?? '') !== String(a ?? '')) {
      out.push({ key, label: FIELD_LABELS[key] ?? key, before: String(b ?? ''), after: String(a ?? '') })
    }
  }
  return out
}

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

interface CheckOption {
  k: string
  l: string
  color?: string
}

function FilterCheckGroup({
  label,
  options,
  state,
  onChange,
}: {
  label: string
  options: CheckOption[]
  state: Record<string, boolean>
  onChange: (s: Record<string, boolean>) => void
}) {
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

const TODAY = new Date().toISOString().slice(0, 10)

function daysTo(s: string): number | null {
  if (!s) return null
  const d = new Date(s)
  const today = new Date(TODAY)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function docWarn(v: Vehicle): { text: string; color: string } | null {
  const keys: (keyof Vehicle)[] = ['tax', 'insurance', 'dispatchPermit']
  const dts = keys
    .map(k => ({ k, d: daysTo(String(v[k] ?? '')) }))
    .filter((x): x is { k: keyof Vehicle; d: number } => x.d !== null && x.d <= 60)
  if (!dts.length) return null
  const min = dts.sort((a, b) => a.d - b.d)[0]
  const labels: Record<string, string> = { tax: 'ภาษี', insurance: 'ประกัน', dispatchPermit: 'ใบอนุญาต' }
  if (min.d < 0) return { text: `${labels[String(min.k)]}: หมดอายุแล้ว`, color: 'var(--red)' }
  return { text: `${labels[String(min.k)]}: ${min.d} วัน`, color: min.d <= 30 ? 'var(--red)' : 'var(--amber)' }
}

const VEHICLE_TYPES = ['4ล้อ', '6ล้อ', '10ล้อ', '18ล้อ', '22ล้อ', 'ตู้คอนเทนเนอร์', 'พ่วงข้าง']

type VehicleGroup = 'INTERNAL' | 'TRANSPORT'

interface VehicleEditForm {
  plate: string
  brand: string
  year: string
  type: string
  customType: string
  groupKind: VehicleGroup
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

function VehicleEditModal({
  vehicle,
  user,
  onClose,
  onSuccess,
  onError,
}: {
  vehicle: Vehicle
  user: User
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const { data: employees = [] } = useList<Employee>('employees')
  const updateVehicle = useUpdate<Vehicle>('vehicles')
  const insertApproval = useInsert<EditApprovalRequest>('edit_approvals')
  const isCustomType = !VEHICLE_TYPES.includes(vehicle.type)
  const [form, setForm] = useState<VehicleEditForm>({
    plate: vehicle.plate,
    brand: vehicle.brand,
    year: String(vehicle.year),
    type: isCustomType ? 'อื่นๆ' : vehicle.type,
    customType: isCustomType ? vehicle.type : '',
    groupKind: (vehicle.groupKind ?? 'TRANSPORT') as VehicleGroup,
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
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof VehicleEditForm>(k: K, v: VehicleEditForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const availableDrivers = employees.filter(
    e => e.position === 'คนขับ' && (!e.vehicleId || e.vehicleId === vehicle.id),
  )

  const submit = () => {
    if (saving) return
    if (!form.plate.trim()) { onError('กรุณากรอกทะเบียนรถ'); return }
    if (!form.brand.trim()) { onError('กรุณากรอกยี่ห้อรถ'); return }
    setSaving(true)
    const effectiveType = form.type === 'อื่นๆ' ? (form.customType.trim() || 'อื่นๆ') : form.type
    const patch: Partial<Vehicle> = {
      plate: form.plate.trim(),
      brand: form.brand.trim(),
      year: Number(form.year) || vehicle.year,
      type: effectiveType,
      groupKind: form.groupKind,
      status: form.status,
      driverId: form.driverId || null,
      odometer: Number(form.odometer) || 0,
      nextServiceKm: Number(form.nextServiceKm) || 0,
      fuel: Math.min(100, Math.max(0, Number(form.fuel) || 0)),
      purchaseDate: form.purchaseDate,
      lastService: form.lastService,
      nextService: form.nextService,
      tax: form.tax,
      insurance: form.insurance,
      dispatchPermit: form.dispatchPermit,
    }

    // Privileged users edit directly; others submit an approval request.
    if (can.editVehicle(user.role)) {
      updateVehicle.mutate(
        { id: vehicle.id, patch },
        {
          onSuccess: () => onSuccess('✅ บันทึกข้อมูลเรียบร้อย'),
          onError: (err) => { onError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'); setSaving(false) },
        },
      )
      return
    }

    if (!can.requestVehicleEdit(user.role)) {
      onError('คุณไม่มีสิทธิ์แก้ไขรถคันนี้'); setSaving(false); return
    }

    const changeFields = buildChangeFields(vehicle, patch)
    if (changeFields.length === 0) { onError('ไม่มีการเปลี่ยนแปลงให้บันทึก'); setSaving(false); return }
    const reason = window.prompt('เหตุผลในการขอแก้ไข (ส่งให้ผู้จัดการอนุมัติ):', '')?.trim()
    if (!reason) { setSaving(false); return }

    insertApproval.mutate(
      {
        id: uid('ear'),
        requesterId: user.id,
        requesterName: user.name,
        requesterRole: user.role,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        reason,
        changes: patch,
        changeFields,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        reviewerId: null,
        reviewerName: null,
        reviewedAt: null,
        reviewNote: '',
      },
      {
        onSuccess: () => onSuccess('📨 ส่งคำขอแก้ไขให้ผู้จัดการอนุมัติแล้ว'),
        onError: (err) => { onError(err instanceof Error ? err.message : 'ส่งคำขอไม่สำเร็จ'); setSaving(false) },
      },
    )
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 12,
          width: '95%', maxWidth: 700, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>แก้ไขข้อมูลรถ</h2>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{vehicle.plate}</span>
            {' · '}{vehicle.brand} · {vehicle.type}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ข้อมูลทั่วไป */}
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--primary)' }}><Icon name="truck" size={16} /></span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>ข้อมูลทั่วไป</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="ทะเบียนรถ *">
                <input value={form.plate} onChange={e => set('plate', e.target.value)} placeholder="เช่น ABC-1234" />
              </Field>
              <Field label="ยี่ห้อ / รุ่น *">
                <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="เช่น Isuzu FVR" />
              </Field>
              <Field label="ปี">
                <input value={form.year} onChange={e => set('year', e.target.value)} placeholder="เช่น 2018" />
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

          {/* กลุ่มรถ (Fuel Routing) */}
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <span style={{ color: 'var(--primary)' }}>⛽</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>กลุ่มรถ (ควบคุมการจ่ายน้ำมัน)</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['INTERNAL', 'TRANSPORT'] as VehicleGroup[]).map(g => {
                const active = form.groupKind === g
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set('groupKind', g)}
                    style={{
                      flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
                      fontFamily: 'inherit', cursor: 'pointer', transition: 'all .12s',
                      border: `2px solid ${active ? '#0066CC' : 'var(--line)'}`,
                      borderRadius: 8,
                      background: active ? '#EFF6FF' : 'var(--card)',
                      color: active ? '#1D4ED8' : 'var(--text-2)',
                    }}
                  >
                    {g === 'INTERNAL' ? '🏭 โรงงาน (INTERNAL)' : '🚛 ขนส่ง (TRANSPORT)'}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              {form.groupKind === 'INTERNAL'
                ? 'น้ำมันถูกตัดสต็อคทันที — ไม่ต้องผูกรอบงาน'
                : 'น้ำมันต้องผูกกับรอบงาน — ถ้าไม่พบรอบจะบันทึกเป็น "น้ำมันลอย"'}
            </div>
          </div>

          {/* ข้อมูลระยะทาง */}
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

          {/* เอกสาร & วันหมดอายุ */}
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
              <Field label="วันหมดอายุพรบ. / ใบอนุญาต">
                <input type="date" value={form.dispatchPermit} onChange={e => set('dispatchPermit', e.target.value)} />
              </Field>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
          <div className="row btn-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose} disabled={saving}>
              <Icon name="close" size={15} /> ยกเลิก
            </button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 12,
          width: '90%', maxWidth: 420, padding: 24,
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: 17, fontWeight: 600 }}>{title}</h2>
        <p style={{ margin: '0 0 22px 0', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.55 }}>
          {message}
        </p>
        <div className="row btn-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>
            ยกเลิก
          </button>
          <button className="btn danger solid" onClick={onConfirm}>
            <Icon name="close" size={15} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ToastState { kind: 'success' | 'error'; msg: string }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, toast.kind === 'success' ? 2800 : 4000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  const ok = toast.kind === 'success'
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
        background: ok ? '#16a34a' : '#A32D2D',
        color: '#fff', padding: '12px 18px', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 14, fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 10,
        minWidth: 280, maxWidth: 420,
        animation: 'kpsToastIn .25s ease-out',
      }}
    >
      <span style={{ flex: 1 }}>{toast.msg}</span>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: 0, opacity: 0.85 }}
      >×</button>
    </div>
  )
}

function RowActionMenu({
  onClose,
  onEdit,
  onDelete,
}: {
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const itemStyle = {
    width: '100%', borderRadius: 0,
    justifyContent: 'flex-start' as const,
    padding: '9px 16px', fontSize: 13,
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', right: 0, top: '100%', zIndex: 100,
        background: 'var(--card)', border: '1px solid var(--line)',
        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
        minWidth: 160, padding: '4px 0',
      }}
    >
      <button
        className="btn ghost"
        style={itemStyle}
        onClick={() => { onClose(); onEdit() }}
      >
        <Icon name="edit" size={14} /> แก้ไข
      </button>
      <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
      <button
        className="btn ghost"
        style={{ ...itemStyle, color: 'var(--red)' }}
        onClick={() => { onClose(); onDelete() }}
      >
        <Icon name="close" size={14} /> ลบ
      </button>
    </div>
  )
}

export function VehiclesPage({ setActive, setSubject, user }: VehiclesPageProps) {
  useRealtimeTable('vehicles')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles', 'plate', true)
  const { data: employees = [] } = useList<Employee>('employees')
  const deleteVehicle = useDelete('vehicles')
  const vehicleTypes = useMemo(() => {
    const types = [...new Set(vehicles.map(v => v.type))].sort()
    return ['ทั้งหมด', ...types]
  }, [vehicles])

  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>({ available: true, maintenance: true, unavailable: true })
  const [filterType, setFilterType] = useState('ทั้งหมด')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const filtered = useMemo(() => {
    return vehicles.filter(v => {
      if (q &&
        !v.plate.toLowerCase().includes(q.toLowerCase()) &&
        !v.brand.toLowerCase().includes(q.toLowerCase()) &&
        !v.type.includes(q)
      ) return false
      if (v.status === 'available' && !filterStatus.available) return false
      if (v.status === 'maintenance' && !filterStatus.maintenance) return false
      if (v.status !== 'available' && v.status !== 'maintenance' && !filterStatus.unavailable) return false
      if (filterType !== 'ทั้งหมด' && v.type !== filterType) return false
      return true
    })
  }, [vehicles, q, filterStatus, filterType])

  const confirmDelete = (v: Vehicle) => {
    deleteVehicle.mutate(v.id, {
      onSuccess: () => {
        setDeletingVehicle(null)
        setToast({ kind: 'success', msg: `✅ ลบรถ ${v.plate} เรียบร้อย` })
      },
      onError: (err) => {
        setToast({ kind: 'error', msg: err instanceof Error ? err.message : 'ลบไม่สำเร็จ' })
      },
    })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายการรถ</h1>
          <div className="page-sub">ทั้งหมด {vehicles.length} คัน</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setActive('vehicles.add')}>
            <Icon name="plus" size={15} /> เพิ่มรถใหม่
          </button>
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div
          style={{
            padding: '16px 20px', borderBottom: '1px solid var(--line)',
            display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
          }}
        >
          <SearchInput value={q} onChange={setQ} placeholder="ค้นหาทะเบียน / ยี่ห้อ / ประเภท" />
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
              {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ทะเบียน</th>
                <th>ยี่ห้อ/รุ่น</th>
                <th>ประเภท</th>
                <th>กลุ่ม</th>
                <th>สถานะ</th>
                <th>คนขับ</th>
                <th className="right">เลขไมล์</th>
                <th>เอกสารหมดอายุ</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const dr = employees.find(e => e.id === v.driverId)
                const dw = docWarn(v)
                return (
                  <tr
                    key={v.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSubject({ type: 'vehicle', id: v.id })
                      setActive('vehicles.detail')
                    }}
                  >
                    <td>
                      <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{v.plate}</span>
                    </td>
                    <td>{v.brand}</td>
                    <td>{v.type}</td>
                    <td>
                      {v.groupKind === 'INTERNAL' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#F0FDF4', color: '#166534' }}>🏭 โรงงาน</span>
                      ) : v.groupKind === 'TRANSPORT' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8' }}>🚛 ขนส่ง</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>{dr ? dr.name : <span className="muted">—</span>}</td>
                    <td className="num right">{db.fmt(v.odometer)}</td>
                    <td>
                      {dw
                        ? <span style={{ color: dw.color, fontSize: 12.5 }}>{dw.text}</span>
                        : <span className="muted">—</span>
                      }
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          className="btn ghost icon sm"
                          onClick={() => setOpenMenuId(openMenuId === v.id ? null : v.id)}
                        >
                          <Icon name="more" size={16} />
                        </button>
                        {openMenuId === v.id && (
                          <RowActionMenu
                            onClose={() => setOpenMenuId(null)}
                            onEdit={() => setEditingVehicle(v)}
                            onDelete={() => setDeletingVehicle(v)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-2)' }}>
                    ไม่พบรายการรถ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div
          style={{
            padding: '12px 20px', borderTop: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 12.5,
          }}
        >
          <span>แสดง {filtered.length} จากทั้งหมด {vehicles.length} รายการ</span>
          <div className="spacer" />
          <div className="row" style={{ gap: 4 }}>
            <button className="btn sm" disabled>ก่อนหน้า</button>
            <button className="btn sm primary">1</button>
            <button className="btn sm" disabled>ถัดไป</button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingVehicle && (
        <VehicleEditModal
          vehicle={editingVehicle}
          user={user}
          onClose={() => setEditingVehicle(null)}
          onSuccess={msg => {
            setEditingVehicle(null)
            setToast({ kind: 'success', msg })
          }}
          onError={msg => setToast({ kind: 'error', msg })}
        />
      )}

      {/* Delete confirm */}
      {deletingVehicle && (
        <ConfirmDialog
          title="ยืนยันการลบข้อมูลรถ"
          message={`⚠️ แน่ใจหรือว่าต้องการลบรถ ${deletingVehicle.plate} (${deletingVehicle.brand}) ออกจากระบบ? ไม่สามารถกู้คืนได้`}
          confirmLabel="ลบ"
          onConfirm={() => confirmDelete(deletingVehicle)}
          onCancel={() => setDeletingVehicle(null)}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
