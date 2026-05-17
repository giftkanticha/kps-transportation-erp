import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import { Icon } from '../../components/ui'
import type { Vehicle, Maintenance } from '../../types'

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
  onClose: () => void
  onSaved: () => void
}

function CompleteModal({ alert, onClose, onSaved }: CompleteModalProps) {
  const [form, setForm] = useState<NextRoundForm>({
    nextDate: '',
    nextMileage: alert.kind === 'mileage' && alert.targetKm
      ? String(alert.targetKm + 10000)
      : '',
    nextMaintenance: '',
  })

  const set = (k: keyof NextRoundForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    const patch: Partial<Vehicle> = {}

    if (alert.kind === 'tax' && form.nextDate) patch.tax = form.nextDate
    if (alert.kind === 'permit' && form.nextDate) patch.dispatchPermit = form.nextDate
    if (alert.kind === 'insurance' && form.nextDate) patch.insurance = form.nextDate
    if (alert.kind === 'mileage' && form.nextMileage) {
      patch.nextServiceKm = Number(form.nextMileage)
    }
    if (alert.kind === 'repair') {
      if (alert.maintenanceId) {
        db.update<Maintenance>('maintenance', alert.maintenanceId, {
          status: 'completed',
          endDate: TODAY.toISOString().slice(0, 10),
        })
      }
      if (form.nextMaintenance) patch.nextService = form.nextMaintenance
    }

    if (Object.keys(patch).length > 0) {
      db.update<Vehicle>('vehicles', alert.vehicleId, patch)
    }

    onSaved()
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
          <button className="btn" onClick={onClose}>
            <Icon name="close" size={14} /> ยกเลิก
          </button>
          <button className="btn primary" onClick={save}>
            <Icon name="check" size={14} /> บันทึก
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

export function AlertsTasksPage() {
  const [tick, setTick] = useState(0)
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)

  const alerts = useMemo(() => {
    const vehicles = db.getAll<Vehicle>('vehicles')
    const maintenance = db.getAll<Maintenance>('maintenance')
    return buildAlerts(vehicles, maintenance)
  }, [tick])

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
          onClose={() => setSelectedAlert(null)}
          onSaved={() => {
            setSelectedAlert(null)
            setTick(t => t + 1)
          }}
        />
      )}
    </div>
  )
}
