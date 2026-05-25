import { useState, useMemo, useEffect } from 'react'
import { db } from '../../lib/db'
import { useList, useUpdate, useInsert } from '../../hooks/useTable'
import { Icon } from '../../components/ui'
import { can } from '../../lib/permissions'
import type { Vehicle, Maintenance, TaskCompletion, EditApprovalRequest, User } from '../../types'

const TODAY = new Date('2026-05-17')
const SOON_DAYS = 30
const SOON_KM = 5000

type AlertKind = 'tax' | 'permit' | 'insurance' | 'mileage' | 'repair'

interface AlertItem {
  id: string
  kind: AlertKind
  vehicleId: string
  plate: string
  brand: string
  type: string
  severity: 'red' | 'amber'
  dueDate?: string
  daysLeft?: number
  currentKm?: number
  targetKm?: number
  kmLeft?: number
  maintenanceId?: string
  repairType?: string
  workshop?: string
}

const KIND_META: Record<AlertKind, { title: string; icon: string; field: string }> = {
  tax: { title: 'ต่อทะเบียน (ภาษีรถ)', icon: 'package', field: 'tax' },
  permit: { title: 'พ.ร.บ. (ใบอนุญาตขนส่ง)', icon: 'check', field: 'dispatchPermit' },
  insurance: { title: 'ประกันภัย', icon: 'check', field: 'insurance' },
  mileage: { title: 'แจ้งเตือนระยะซ่อม', icon: 'wrench', field: 'nextServiceKm' },
  repair: { title: 'งานซ่อมค้าง', icon: 'wrench', field: 'nextService' },
}

function daysBetween(dateStr: string): number {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return Infinity
  return Math.round((d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))
}

function severityFromDays(days: number): 'red' | 'amber' | null {
  if (days < 0) return 'red'
  if (days <= SOON_DAYS) return 'amber'
  return null
}

function severityFromKm(kmLeft: number): 'red' | 'amber' | null {
  if (kmLeft <= 0) return 'red'
  if (kmLeft <= SOON_KM) return 'amber'
  return null
}

function buildDateAlert(v: Vehicle, kind: 'tax' | 'permit' | 'insurance', dateStr: string): AlertItem | null {
  const days = daysBetween(dateStr)
  const sev = severityFromDays(days)
  if (!sev) return null
  return {
    id: `${kind}-${v.id}`,
    kind,
    vehicleId: v.id,
    plate: v.plate,
    brand: v.brand,
    type: v.type,
    severity: sev,
    dueDate: dateStr,
    daysLeft: days,
  }
}

function buildAlerts(vehicles: Vehicle[], maintenance: Maintenance[]): AlertItem[] {
  const out: AlertItem[] = []

  vehicles.forEach(v => {
    const tax = buildDateAlert(v, 'tax', v.tax)
    if (tax) out.push(tax)
    const permit = buildDateAlert(v, 'permit', v.dispatchPermit)
    if (permit) out.push(permit)
    const ins = buildDateAlert(v, 'insurance', v.insurance)
    if (ins) out.push(ins)

    const kmLeft = v.nextServiceKm - v.odometer
    const mileSev = severityFromKm(kmLeft)
    if (mileSev) {
      out.push({
        id: `mileage-${v.id}`,
        kind: 'mileage',
        vehicleId: v.id,
        plate: v.plate,
        brand: v.brand,
        type: v.type,
        severity: mileSev,
        currentKm: v.odometer,
        targetKm: v.nextServiceKm,
        kmLeft,
      })
    }
  })

  maintenance.forEach(m => {
    if (m.status === 'completed') return
    const v = vehicles.find(x => x.id === m.vehicleId)
    if (!v) return
    const days = daysBetween(m.startDate)
    const sev: 'red' | 'amber' = days < 0 || m.status === 'in-progress' ? 'red' : 'amber'
    out.push({
      id: `repair-${m.id}`,
      kind: 'repair',
      vehicleId: v.id,
      plate: v.plate,
      brand: v.brand,
      type: v.type,
      severity: sev,
      maintenanceId: m.id,
      repairType: m.type,
      workshop: m.workshop,
      dueDate: m.startDate,
      daysLeft: days,
    })
  })

  return out
}

interface NextRoundForm {
  nextDate: string
  nextMileage: string
  nextMaintenance: string
}

interface CompleteModalProps {
  alert: AlertItem
  user: User
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}

interface SaveDeps {
  userId: string
  updateMaint: (args: { id: string; patch: Partial<Maintenance> }) => Promise<unknown>
  updateVehicle: (args: { id: string; patch: Partial<Vehicle> }) => Promise<unknown>
  insertTask: (row: Partial<TaskCompletion>) => Promise<unknown>
}

async function saveNextRound(alert: AlertItem, form: NextRoundForm, deps: SaveDeps): Promise<void> {
  const patch: Partial<Vehicle> = {}

  if (alert.kind === 'tax' && form.nextDate) patch.tax = form.nextDate
  if (alert.kind === 'permit' && form.nextDate) patch.dispatchPermit = form.nextDate
  if (alert.kind === 'insurance' && form.nextDate) patch.insurance = form.nextDate
  if (alert.kind === 'mileage' && form.nextMileage) {
    const n = Number(form.nextMileage)
    if (isNaN(n) || n <= 0) throw new Error('เลขไมล์ไม่ถูกต้อง')
    patch.nextServiceKm = n
  }
  if (alert.kind === 'repair' && form.nextMaintenance) {
    patch.nextService = form.nextMaintenance
  }

  if (form.nextDate && (alert.kind === 'tax' || alert.kind === 'permit' || alert.kind === 'insurance')) {
    const d = new Date(form.nextDate)
    if (isNaN(d.getTime())) throw new Error('วันที่ไม่ถูกต้อง')
    if (d.getTime() < TODAY.getTime()) throw new Error('วันที่รอบถัดไปต้องเป็นอนาคต')
  }

  if (alert.kind === 'repair' && alert.maintenanceId) {
    await deps.updateMaint({
      id: alert.maintenanceId,
      patch: { status: 'completed', endDate: TODAY.toISOString().slice(0, 10) },
    })
  }

  if (Object.keys(patch).length > 0) {
    await deps.updateVehicle({ id: alert.vehicleId, patch })
  }

  await deps.insertTask({
    alertKind: alert.kind,
    vehicleId: alert.vehicleId,
    vehiclePlate: alert.plate,
    completedAt: new Date().toISOString(),
    userId: deps.userId,
    nextDate: form.nextDate,
    nextMileage: form.nextMileage ? Number(form.nextMileage) : null,
    nextMaintenanceDate: form.nextMaintenance,
    note: '',
  })
}

function CompleteModal({ alert, user, onClose, onSuccess, onError }: CompleteModalProps) {
  const [form, setForm] = useState<NextRoundForm>({
    nextDate: '',
    nextMileage: alert.kind === 'mileage' && alert.targetKm
      ? String(alert.targetKm + 10000)
      : '',
    nextMaintenance: '',
  })
  const [saving, setSaving] = useState(false)
  const updateMaint = useUpdate<Maintenance>('maintenance')
  const updateVehicle = useUpdate<Vehicle>('vehicles')
  const insertTask = useInsert<TaskCompletion>('task_completions')

  const set = (k: keyof NextRoundForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await saveNextRound(alert, form, {
        userId: user.id,
        updateMaint: (a) => updateMaint.mutateAsync(a),
        updateVehicle: (a) => updateVehicle.mutateAsync(a),
        insertTask: (r) => insertTask.mutateAsync(r),
      })
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'
      onError(msg)
      setSaving(false)
    }
  }

  const labelOfDateField = () => {
    if (alert.kind === 'tax') return 'วันหมดอายุภาษี รอบถัดไป'
    if (alert.kind === 'permit') return 'วันหมดอายุ พ.ร.บ. รอบถัดไป'
    if (alert.kind === 'insurance') return 'วันหมดอายุประกันภัย รอบถัดไป'
    return 'วันหมดอายุ พ.ร.บ./ภาษี รอบถัดไป'
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          width: '90%',
          maxWidth: 520,
          padding: 24,
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>
          บันทึกรอบถัดไป
        </h2>
        <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 18 }}>
          {KIND_META[alert.kind].title} • <span className="mono" style={{ fontWeight: 600 }}>{alert.plate}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              {labelOfDateField()}
            </label>
            <input
              type="date"
              value={form.nextDate}
              onChange={e => set('nextDate', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              เลขไมล์ที่ต้องเปลี่ยนน้ำมันเครื่องรอบถัดไป (กม.)
            </label>
            <input
              type="number"
              value={form.nextMileage}
              onChange={e => set('nextMileage', e.target.value)}
              placeholder="เช่น 260000"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              วันนัดหมายซ่อมบำรุงครั้งต่อไป
            </label>
            <input
              type="date"
              value={form.nextMaintenance}
              onChange={e => set('nextMaintenance', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={saving}>
            <Icon name="close" size={14} /> ยกเลิก
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            <Icon name="check" size={14} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface AlertCardProps {
  alert: AlertItem
  onComplete: () => void
}

function AlertCard({ alert, onComplete }: AlertCardProps) {
  const badgeColor = alert.severity === 'red' ? '#A32D2D' : '#BA7517'
  const badgeBg = alert.severity === 'red' ? 'rgba(163,45,45,.10)' : 'rgba(186,117,23,.10)'
  const borderColor = alert.severity === 'red' ? '#A32D2D' : '#BA7517'

  const badgeText = () => {
    if (alert.kind === 'mileage') {
      if (alert.severity === 'red') return 'เกินกำหนด'
      return `เหลือ ${db.fmt(alert.kmLeft)} กม.`
    }
    if (alert.severity === 'red') {
      const overdue = Math.abs(alert.daysLeft || 0)
      return `เกินกำหนด ${overdue} วัน`
    }
    return `อีก ${alert.daysLeft} วัน`
  }

  const detailLine = () => {
    if (alert.kind === 'mileage') {
      return `${db.fmt(alert.currentKm)} / ${db.fmt(alert.targetKm)} กม.`
    }
    if (alert.kind === 'repair') {
      return `${alert.repairType} • ${alert.workshop}`
    }
    return `ครบกำหนด ${db.thaiDate(alert.dueDate!)}`
  }

  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderLeft: `4px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
              {alert.plate}
            </span>
            <span className="muted" style={{ fontSize: 11.5 }}>
              {alert.brand} · {alert.type}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>
            {detailLine()}
          </div>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 999,
            background: badgeBg,
            color: badgeColor,
            whiteSpace: 'nowrap',
          }}
        >
          {badgeText()}
        </span>
      </div>

      <button
        onClick={onComplete}
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
        }}
      >
        <Icon name="check" size={14} /> ดำเนินการเรียบร้อย
      </button>
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
        zIndex: 1100,
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
        aria-label="ปิด"
      >
        ×
      </button>
    </div>
  )
}

interface SectionProps {
  kind: AlertKind
  alerts: AlertItem[]
  onComplete: (a: AlertItem) => void
}

function Section({ kind, alerts, onComplete }: SectionProps) {
  const meta = KIND_META[kind]
  const redCount = alerts.filter(a => a.severity === 'red').length
  const amberCount = alerts.filter(a => a.severity === 'amber').length

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="row" style={{ marginBottom: 12, gap: 10, alignItems: 'center' }}>
        <Icon name={meta.icon} size={18} style={{ color: 'var(--primary)' }} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{meta.title}</h3>
        {redCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(163,45,45,.10)',
              color: '#A32D2D',
            }}
          >
            เกินกำหนด {redCount}
          </span>
        )}
        {amberCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(186,117,23,.10)',
              color: '#BA7517',
            }}
          >
            ใกล้ครบกำหนด {amberCount}
          </span>
        )}
        {alerts.length === 0 && (
          <span className="muted" style={{ fontSize: 12 }}>— ไม่มีรายการ —</span>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="grid-3" style={{ gap: 14 }}>
          {alerts.map(a => (
            <AlertCard key={a.id} alert={a} onComplete={() => onComplete(a)} />
          ))}
        </div>
      )}
    </div>
  )
}

interface PendingApprovalsSectionProps {
  user: User
  requests: EditApprovalRequest[]
  onReview: (req: EditApprovalRequest, decision: 'approved' | 'rejected') => void
}

function PendingApprovalsSection({ user, requests, onReview }: PendingApprovalsSectionProps) {
  if (!can.reviewApprovals(user.role)) return null

  const formatWhen = (iso: string): string => {
    const d = new Date(iso)
    const diffMs = Date.now() - d.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    if (hours < 1) return 'ไม่กี่นาทีที่แล้ว'
    if (hours < 24) return `${hours} ชม.ที่แล้ว`
    return db.thaiDate(iso.slice(0, 10))
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="row" style={{ marginBottom: 12, gap: 10, alignItems: 'center' }}>
        <Icon name="bell" size={18} style={{ color: 'var(--primary)' }} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>รอการอนุมัติ</h3>
        {requests.length > 0 ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--primary-50)',
              color: 'var(--primary)',
            }}
          >
            {requests.length} คำขอ
          </span>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>— ไม่มีคำขอที่รอการอนุมัติ —</span>
        )}
      </div>

      {requests.length > 0 && (
        <div className="grid-2" style={{ gap: 14 }}>
          {requests.map(req => (
            <div
              key={req.id}
              className="card"
              style={{
                padding: 16,
                borderLeft: '4px solid var(--primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    <strong>{req.requesterName}</strong>
                    <span className="muted"> ขอแก้ไข </span>
                    <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {req.vehiclePlate}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                    เหตุผล: {req.reason}
                  </div>
                </div>
                <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  {formatWhen(req.requestedAt)}
                </span>
              </div>

              <div
                style={{
                  background: 'var(--bg-sunk)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 12,
                }}
              >
                {req.changeFields.map((f, i) => (
                  <div key={i} className="row" style={{ gap: 6, alignItems: 'center', marginTop: i > 0 ? 4 : 0 }}>
                    <span style={{ color: 'var(--text-2)', minWidth: 110 }}>{f.label}:</span>
                    <span className="mono muted">{f.before}</span>
                    <Icon name="arrow-right" size={11} style={{ color: 'var(--text-faint)' }} />
                    <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{f.after}</span>
                  </div>
                ))}
              </div>

              <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => onReview(req, 'rejected')}
                  style={{
                    background: '#A32D2D',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="close" size={13} /> ปฏิเสธ
                </button>
                <button
                  onClick={() => onReview(req, 'approved')}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="check" size={13} /> อนุมัติ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface AlertsTasksPageProps {
  user: User
}

export function AlertsTasksPage({ user }: AlertsTasksPageProps) {
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const { data: editApprovals = [] } = useList<EditApprovalRequest>('edit_approvals')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: maintenance = [] } = useList<Maintenance>('maintenance')
  const updateApproval = useUpdate<EditApprovalRequest>('edit_approvals')
  const updateVehicle = useUpdate<Vehicle>('vehicles')

  const pendingApprovals = useMemo(() => {
    if (!can.reviewApprovals(user.role)) return []
    return [...editApprovals]
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  }, [editApprovals, user.role])

  const reviewRequest = async (req: EditApprovalRequest, decision: 'approved' | 'rejected') => {
    try {
      const fresh = editApprovals.find(r => r.id === req.id)
      if (!fresh) throw new Error('ไม่พบคำขอในระบบ')
      if (fresh.status !== 'pending') throw new Error('คำขอนี้ถูกพิจารณาแล้ว')

      if (decision === 'approved') {
        await updateVehicle.mutateAsync({ id: req.vehicleId, patch: req.changes })
      }

      await updateApproval.mutateAsync({
        id: req.id,
        patch: {
          status: decision,
          reviewerId: user.id,
          reviewerName: user.name,
          reviewedAt: new Date().toISOString(),
        },
      })

      setToast({
        kind: 'success',
        msg: decision === 'approved'
          ? `อนุมัติคำขอจาก ${req.requesterName} เรียบร้อย`
          : `ปฏิเสธคำขอจาก ${req.requesterName} แล้ว`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ'
      setToast({ kind: 'error', msg })
    }
  }

  const alerts = useMemo(() => buildAlerts(vehicles, maintenance), [vehicles, maintenance])

  const grouped = useMemo(() => {
    const map: Record<AlertKind, AlertItem[]> = {
      tax: [],
      permit: [],
      insurance: [],
      mileage: [],
      repair: [],
    }
    alerts.forEach(a => map[a.kind].push(a))
    Object.keys(map).forEach(k => {
      map[k as AlertKind].sort((x, y) => {
        if (x.severity !== y.severity) return x.severity === 'red' ? -1 : 1
        const xd = x.kind === 'mileage' ? (x.kmLeft || 0) : (x.daysLeft || 0)
        const yd = y.kind === 'mileage' ? (y.kmLeft || 0) : (y.daysLeft || 0)
        return xd - yd
      })
    })
    return map
  }, [alerts])

  const totalRed = alerts.filter(a => a.severity === 'red').length
  const totalAmber = alerts.filter(a => a.severity === 'amber').length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">แจ้งเตือนและแผนงาน</h1>
          <div className="page-sub">
            ภาพรวมงานที่ต้องดำเนินการ — ภาษี, พ.ร.บ., ประกันภัย, ซ่อมบำรุง
          </div>
        </div>
        <div className="actions">
          <div className="row" style={{ gap: 10 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(163,45,45,.10)',
                color: '#A32D2D',
              }}
            >
              <span className="sdot red" /> เกินกำหนด {totalRed}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(186,117,23,.10)',
                color: '#BA7517',
              }}
            >
              <span className="sdot amber" /> ใกล้ครบกำหนด {totalAmber}
            </span>
          </div>
        </div>
      </div>

      <PendingApprovalsSection user={user} requests={pendingApprovals} onReview={reviewRequest} />

      <Section kind="tax" alerts={grouped.tax} onComplete={setSelectedAlert} />
      <Section kind="permit" alerts={grouped.permit} onComplete={setSelectedAlert} />
      <Section kind="insurance" alerts={grouped.insurance} onComplete={setSelectedAlert} />
      <Section kind="mileage" alerts={grouped.mileage} onComplete={setSelectedAlert} />
      <Section kind="repair" alerts={grouped.repair} onComplete={setSelectedAlert} />

      {alerts.length === 0 && (
        <div className="card pad" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
            ไม่มีรายการที่ต้องดำเนินการในตอนนี้
          </div>
        </div>
      )}

      {selectedAlert && (
        <CompleteModal
          alert={selectedAlert}
          user={user}
          onClose={() => setSelectedAlert(null)}
          onSuccess={() => {
            setSelectedAlert(null)
            setToast({ kind: 'success', msg: 'บันทึกรอบถัดไปเรียบร้อย' })
          }}
          onError={msg => {
            setToast({ kind: 'error', msg: `บันทึกไม่สำเร็จ: ${msg}` })
          }}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
