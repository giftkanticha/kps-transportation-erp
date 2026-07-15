import { useState } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { useAuth } from '../../context/AuthContext'
import { Icon, StatusBadge, Field } from '../../components/ui'
import type { Maintenance, Vehicle } from '../../types'

const STATUSES = ['scheduled', 'in-progress', 'completed', 'cancelled'] as const
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'นัดหมาย', 'in-progress': 'กำลังซ่อม', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
}
const TYPES = ['ตรวจเช็คประจำ', 'เปลี่ยนน้ำมันเครื่อง', 'ซ่อมเครื่องยนต์', 'ซ่อมระบบเบรก', 'ซ่อมระบบส่งกำลัง', 'ซ่อมตัวถัง', 'อื่นๆ']

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function nextCode(existing: Maintenance[]): string {
  const ymd = todayISO().replace(/-/g, '')
  const prefix = 'MNT-' + ymd + '-'
  const todays = existing.filter(m => m.code?.startsWith(prefix))
  const maxSeq = todays.reduce((max, m) => {
    const n = parseInt(m.code.slice(prefix.length), 10)
    return Number.isNaN(n) ? max : Math.max(max, n)
  }, 0)
  return prefix + String(maxSeq + 1).padStart(3, '0')
}

export function MaintenancePage() {
  const { isManager } = useAuth()
  const { data: all = [] } = useList<Maintenance>('maintenance')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const plateOf = (id: string) => vehicles.find(v => v.id === id)?.plate ?? '—'
  const insertMaintenance = useInsert<Maintenance>('maintenance', {
    activity: m => `สั่งบำรุงรักษา ${m.code} (${plateOf(m.vehicleId)})`,
  })
  const updateMaintenance = useUpdate<Maintenance>('maintenance', {
    activity: m => `แก้ไขงานบำรุงรักษา ${m.code} (${plateOf(m.vehicleId)})`,
  })

  const inProgress = all.filter(m => m.status === 'in-progress')
  const scheduled  = all.filter(m => m.status === 'scheduled')
  const thisMonth  = todayISO().slice(0, 7)
  const thisMontCost = all.filter(m => (m.startDate ?? '').startsWith(thisMonth)).reduce((s, m) => s + (m.cost || 0), 0)

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Maintenance | null>(null)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">การบำรุงรักษา</h1>
          <div className="page-sub">
            {all.length} รายการ • กำลังซ่อม {inProgress.length} • นัดหมาย {scheduled.length}
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowAdd(true)} disabled={vehicles.length === 0}>
            <Icon name="plus" size={15} /> สั่งบำรุงรักษา
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="label">กำลังซ่อม</div>
          <div className="row">
            <div className="icn-box"><Icon name="wrench" size={18} /></div>
            <div className="value">{inProgress.length}<span className="unit">งาน</span></div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">นัดหมายล่วงหน้า</div>
          <div className="row">
            <div className="icn-box amber"><Icon name="calendar" size={18} /></div>
            <div className="value">{scheduled.length}<span className="unit">งาน</span></div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ค่าใช้จ่ายเดือนนี้</div>
          <div className="row">
            <div className="icn-box red"><Icon name="money" size={18} /></div>
            <div className="value">{db.thb(thisMontCost)}</div>
          </div>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>รถ</th>
              <th>ประเภท</th>
              <th>รายการ</th>
              <th>อู่/ศูนย์</th>
              <th>วันที่</th>
              <th className="right">ค่าใช้จ่าย</th>
              <th>สถานะ</th>
              {isManager && <th></th>}
            </tr>
          </thead>
          <tbody>
            {all.length === 0 && (
              <tr><td colSpan={isManager ? 9 : 8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-2)' }}>
                ยังไม่มีรายการบำรุงรักษา — กด "สั่งบำรุงรักษา" เพื่อเพิ่ม
              </td></tr>
            )}
            {all.map(m => (
              <tr key={m.id}>
                <td className="mono">{m.code}</td>
                <td><span className="mono badge gray">{plateOf(m.vehicleId)}</span></td>
                <td>{m.type}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>{(m.items ?? []).join(' • ')}</td>
                <td>{m.workshop}</td>
                <td className="num muted">{m.startDate}</td>
                <td className="num right" style={{ fontWeight: 600 }}>{m.cost > 0 ? db.thb(m.cost) : '—'}</td>
                <td><StatusBadge status={m.status} /></td>
                {isManager && (
                  <td>
                    <button className="btn ghost icon sm" title="แก้ไข / รายละเอียด" onClick={() => setEditing(m)}>
                      <Icon name="edit" size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <MaintenanceFormModal
          vehicles={vehicles}
          existing={all}
          onClose={() => setShowAdd(false)}
          onSave={async row => {
            try {
              await insertMaintenance.mutateAsync(row)
              setShowAdd(false)
            } catch (e) {
              alert(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
            }
          }}
        />
      )}

      {editing && (
        <MaintenanceFormModal
          vehicles={vehicles}
          existing={all}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async row => {
            try {
              await updateMaintenance.mutateAsync({ id: editing.id, patch: row })
              setEditing(null)
            } catch (e) {
              alert(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
            }
          }}
        />
      )}
    </div>
  )
}

function MaintenanceFormModal({
  vehicles, existing, initial, onClose, onSave,
}: {
  vehicles: Vehicle[]
  existing: Maintenance[]
  initial?: Maintenance
  onClose: () => void
  onSave: (row: Partial<Maintenance>) => Promise<void>
}) {
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? vehicles[0]?.id ?? '')
  const [type, setType] = useState(initial?.type ?? TYPES[0])
  const [items, setItems] = useState((initial?.items ?? []).join('\n'))
  const [workshop, setWorkshop] = useState(initial?.workshop ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [cost, setCost] = useState(initial ? String(initial.cost || '') : '')
  const [status, setStatus] = useState<string>(initial?.status ?? 'scheduled')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setErr(null)
    if (!vehicleId) { setErr('กรุณาเลือกรถ'); return }
    if (!type)      { setErr('กรุณาเลือกประเภท'); return }
    if (!startDate) { setErr('กรุณาเลือกวันที่'); return }
    setBusy(true)
    try {
      const v = vehicles.find(x => x.id === vehicleId)
      await onSave({
        ...(initial ? {} : { id: 'mnt_' + Date.now().toString(36), code: nextCode(existing) }),
        vehicleId,
        type,
        workshop: workshop.trim(),
        partnerId: initial?.partnerId ?? null,
        status,
        cost: Number(cost) || 0,
        startDate,
        endDate: endDate || null,
        odometer: initial?.odometer ?? v?.odometer ?? 0,
        items: items.split('\n').map(s => s.trim()).filter(Boolean),
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="head"><h3>{initial ? `แก้ไขงานบำรุงรักษา · ${initial.code}` : 'สั่งบำรุงรักษา'}</h3></div>
        <div className="body">
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="รถ *">
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} · {v.brand}</option>
                ))}
              </select>
            </Field>
            <Field label="ประเภท *">
              <select value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="วันที่เริ่ม *">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Field>
            <Field label="วันที่เสร็จ">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </Field>
            <Field label="สถานะ">
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="อู่/ศูนย์บริการ">
              <input value={workshop} onChange={e => setWorkshop(e.target.value)} placeholder="เช่น อู่สมศักดิ์" />
            </Field>
            <Field label="ค่าใช้จ่าย (บาท)">
              <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" />
            </Field>
            <Field label="รายการ (บรรทัดละ 1 รายการ)" full>
              <textarea value={items} onChange={e => setItems(e.target.value)} rows={3} placeholder="เช่น เปลี่ยนน้ำมันเครื่อง&#10;เปลี่ยนไส้กรองอากาศ" style={{ resize: 'vertical' }} />
            </Field>
          </div>
          {err && (
            <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--red-50)', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
              {err}
            </div>
          )}
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}
