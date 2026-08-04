import { useState, useMemo, useRef, useEffect } from 'react'
import { db } from '../../lib/db'
import { useList, useUpdate, useDelete } from '../../hooks/useTable'
import { useAuth } from '../../context/AuthContext'
import type { Employee, Vehicle } from '../../types'
import { Icon, StatusBadge, Field, SearchInput } from '../../components/ui'

function isDriverPosition(pos: string): boolean {
  return pos === 'คนขับ'
}

interface EmployeesPageProps {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
}

interface FilterStatus {
  active: boolean
  leave: boolean
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

interface ToastState {
  kind: 'success' | 'error'
  msg: string
}

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
      <span style={{ fontSize: 18 }}>{ok ? '✅' : '⚠️'}</span>
      <span style={{ flex: 1 }}>{toast.msg}</span>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: 0, opacity: .85, lineHeight: 1 }}
      >×</button>
    </div>
  )
}

function ConfirmDialog({
  title, message, confirmLabel, destructive, onConfirm, onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', borderRadius: 12, width: '90%', maxWidth: 420, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,.25)' }}
      >
        <h2 style={{ margin: '0 0 10px 0', fontSize: 17, fontWeight: 700 }}>{title}</h2>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-2)', fontSize: 14 }}>{message}</p>
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
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

// วันนี้จริง normalize เป็นเที่ยงคืน ให้จำนวนวันคงเหลือนับเต็มวัน
const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function LicenseLabel({ status, expire }: { status: string; expire: string }) {
  if (status === 'ok') {
    return (
      <span className="badge green">
        <span className="sdot green" />
        ถูกต้อง
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="badge red">
        <span className="sdot red" />
        หมดอายุ
      </span>
    )
  }
  const d = new Date(expire)
  const days = Math.round((d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))
  return (
    <span className="badge amber">
      <span className="sdot amber" />
      {days} วัน
    </span>
  )
}

interface ActionMenuProps {
  onClose: () => void
  onEdit: () => void
  onChangeStatus: () => void
  onDelete: () => void
}

function ActionMenu({ onClose, onEdit, onChangeStatus, onDelete }: ActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

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
        minWidth: 168,
        padding: '4px 0',
      }}
    >
      <button
        className="btn ghost"
        style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13 }}
        onClick={() => { onClose(); onEdit() }}
      >
        <Icon name="edit" size={14} /> แก้ไขข้อมูล
      </button>
      <button
        className="btn ghost"
        style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: 'var(--amber)' }}
        onClick={() => { onClose(); onChangeStatus() }}
      >
        <Icon name="refresh" size={14} /> เปลี่ยนสถานะ
      </button>
      <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
      <button
        className="btn ghost"
        style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: '#A32D2D' }}
        onClick={() => { onClose(); onDelete() }}
      >
        <Icon name="close" size={14} /> ลบพนักงาน
      </button>
    </div>
  )
}

interface EmployeeEditModalProps {
  employee: Employee
  onClose: () => void
  onSaved: () => void
}

function EmployeeEditModal({ employee, onClose, onSaved }: EmployeeEditModalProps) {
  const { isManager } = useAuth()
  const { data: allVehicles = [] } = useList<Vehicle>('vehicles')
  const { data: allEmployees = [] } = useList<Employee>('employees')
  const updateEmployee = useUpdate<Employee>('employees')
  const updateVehicle = useUpdate<Vehicle>('vehicles')
  const empName = (id: string) => allEmployees.find(e => e.id === id)?.name ?? '—'
  const initialVehicleIds = useMemo(
    () => allVehicles.filter(v => v.driverId === employee.id).map(v => v.id),
    [allVehicles, employee.id],
  )

  const [form, setForm] = useState({
    name: employee.name,
    position: employee.position,
    phone: employee.phone,
    lineId: employee.lineId,
    joined: employee.joined,
    address: employee.address ?? '',
    salary: String(employee.salary ?? 0),
  })
  const [vehicleIds, setVehicleIds] = useState<string[]>(initialVehicleIds)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const toggleVehicle = (id: string) =>
    setVehicleIds(ids => (ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]))

  const isDriver = isDriverPosition(form.position)

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      alert('กรุณากรอกชื่อและเบอร์โทร')
      return
    }
    if (updateEmployee.isPending) return
    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        patch: {
          name: form.name.trim(),
          position: form.position,
          phone: form.phone.trim(),
          lineId: form.lineId,
          joined: form.joined,
          address: form.address,
          // Salary is excluded from non-manager patches so a regular
          // employee editing their own row (e.g. phone update) can't
          // overwrite the salary on the server.
          ...(isManager ? { salary: Number(form.salary) || 0 } : {}),
          vehicleId: isDriver ? (vehicleIds[0] ?? null) : null,
        },
      })

      // Sync Vehicle.driverId for the selected set:
      //   - vehicles newly selected → set driverId to this employee
      //   - vehicles previously assigned to this employee but now deselected → clear driverId
      if (isDriver) {
        const finalSet = new Set(vehicleIds)
        const prevSet = new Set(initialVehicleIds)
        for (const v of allVehicles) {
          const wasAssigned = prevSet.has(v.id)
          const nowAssigned = finalSet.has(v.id)
          if (nowAssigned && v.driverId !== employee.id) {
            await updateVehicle.mutateAsync({ id: v.id, patch: { driverId: employee.id } })
          } else if (!nowAssigned && wasAssigned) {
            await updateVehicle.mutateAsync({ id: v.id, patch: { driverId: null } })
          }
        }
      } else {
        // Position changed away from คนขับ → clear all previously assigned vehicles
        for (const vId of initialVehicleIds) {
          await updateVehicle.mutateAsync({ id: vId, patch: { driverId: null } })
        }
      }
      onClose()
      onSaved()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 12,
          width: '95%', maxWidth: 560, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>แก้ไขข้อมูลพนักงาน</h2>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{employee.code}</span>
            {' · '}{employee.name || '—'}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="เลขที่ ID">
              <input value={employee.code} readOnly style={{ background: 'var(--bg-sunk)', color: 'var(--text-muted)', cursor: 'default' }} />
            </Field>
            <Field label="ตำแหน่ง">
              <input value={form.position} onChange={e => set('position', e.target.value)} placeholder="เช่น คนขับ" />
            </Field>
            <Field label="ชื่อ-สกุล *">
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="เช่น สมชาย ใจดี" />
            </Field>
            <Field label="เบอร์โทรศัพท์ *">
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="เช่น 0812345678" />
            </Field>
            <Field label="Line ID">
              <input value={form.lineId} onChange={e => set('lineId', e.target.value)} placeholder="เช่น @somchai" />
            </Field>
            <Field label="วันเริ่มงาน">
              <input type="date" value={form.joined} onChange={e => set('joined', e.target.value)} />
            </Field>
            {isManager && (
              <Field label="เงินเดือน (บาท/เดือน)">
                <input
                  type="number"
                  value={form.salary}
                  onChange={e => set('salary', e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </Field>
            )}
          </div>

          <Field label="ที่อยู่">
            <textarea
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="เช่น 123/4 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ 10110"
              rows={2}
              style={{ width: '100%', resize: 'vertical', minHeight: 44 }}
            />
          </Field>

          {isDriver && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
                ทะเบียนรถที่รับผิดชอบ
                <span className="muted" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                  (เลือกได้หลายคัน · เชื่อมกับเมนูรายการรถ)
                </span>
              </label>
              {allVehicles.length === 0 ? (
                <div
                  style={{
                    padding: 12, border: '1px dashed var(--line)', borderRadius: 8,
                    fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center',
                  }}
                >ยังไม่มีรถในระบบ</div>
              ) : (
                <div
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: 8,
                    padding: 10, border: '1px solid var(--line)', borderRadius: 8,
                    maxHeight: 180, overflowY: 'auto',
                  }}
                >
                  {allVehicles.map(v => {
                    const checked = vehicleIds.includes(v.id)
                    const otherDriver = !checked && v.driverId && v.driverId !== employee.id
                      ? empName(v.driverId)
                      : null
                    return (
                      <label
                        key={v.id}
                        className="row"
                        style={{
                          gap: 6, cursor: 'pointer', fontSize: 13,
                          padding: '6px 10px', borderRadius: 6,
                          border: '1px solid ' + (checked ? 'var(--primary)' : 'var(--line)'),
                          background: checked ? 'var(--primary-50, #EFF6FF)' : 'var(--card)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleVehicle(v.id)}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span className="mono" style={{ fontWeight: 600 }}>{v.plate}</span>
                        <span className="muted" style={{ fontSize: 11 }}>{v.type}</span>
                        {otherDriver && (
                          <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>
                            (ปัจจุบัน: {otherDriver})
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                เลือกแล้ว: {vehicleIds.length} คัน
                {vehicleIds.length > 0 && (
                  <> — เมื่อเปิดงาน ระบบจะ auto-fill คนขับนี้เมื่อเลือกรถดังกล่าว</>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            <Icon name="close" size={15} /> ยกเลิก
          </button>
          <button className="btn primary" onClick={save} disabled={updateEmployee.isPending}>
            <Icon name="check" size={15} /> {updateEmployee.isPending ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface StatusChangeDialogProps {
  employee: Employee
  onClose: () => void
  onChanged: () => void
}

function StatusChangeDialog({ employee, onClose, onChanged }: StatusChangeDialogProps) {
  const updateEmployee = useUpdate<Employee>('employees')
  const changeStatus = (status: Employee['status']) => {
    updateEmployee.mutate(
      { id: employee.id, patch: { status } },
      {
        onSuccess: () => { onClose(); onChanged() },
        onError: (err) => alert(err instanceof Error ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ'),
      },
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--card)', borderRadius: 12, width: '90%', maxWidth: 400, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,.2)' }}>
        <h2 style={{ margin: '0 0 18px 0', fontSize: 18, fontWeight: 600 }}>เปลี่ยนสถานะพนักงาน</h2>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-2)', fontSize: 14 }}>{employee.name}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <button
            className={`btn ${employee.status === 'active' ? 'primary' : ''}`}
            onClick={() => changeStatus('active')}
            style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 14 }}
          >
            <span style={{ color: 'var(--green)' }}>●</span> ทำงาน
          </button>
          <button
            className={`btn ${employee.status === 'training' ? 'primary' : ''}`}
            onClick={() => changeStatus('training')}
            style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 14 }}
          >
            <span style={{ color: 'var(--amber)' }}>●</span> อบรม
          </button>
          <button
            className={`btn ${employee.status === 'leave' ? 'primary' : ''}`}
            onClick={() => changeStatus('leave')}
            style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 14 }}
          >
            <span style={{ color: 'var(--red)' }}>●</span> ลาออก
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  )
}

export function EmployeesPage({ setActive, setSubject }: EmployeesPageProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>({ active: true, leave: false })

  const { data: allEmployees = [] } = useList<Employee>('employees')
  const { data: allVehicles = [] } = useList<Vehicle>('vehicles')
  const deleteEmployee = useDelete('employees')

  const inBucket = (e: Employee): boolean =>
    (filterStatus.active && (e.status === 'active' || e.status === 'training')) ||
    (filterStatus.leave && e.status === 'leave')

  const filtered = useMemo(() => {
    return allEmployees.filter(e => {
      if (
        q &&
        !e.name.toLowerCase().includes(q.toLowerCase()) &&
        !e.code.toLowerCase().includes(q.toLowerCase()) &&
        !e.phone.includes(q)
      )
        return false
      if (!inBucket(e)) return false
      return true
    })
  }, [allEmployees, q, filterStatus])

  const deletingEmployee = deletingId ? allEmployees.find(e => e.id === deletingId) : null

  const handleDelete = () => {
    if (!deletingId) return
    deleteEmployee.mutate(deletingId, {
      onSuccess: () => {
        setDeletingId(null)
        setToast({ kind: 'success', msg: 'ลบพนักงานเรียบร้อยแล้ว' })
      },
      onError: (err) => setToast({ kind: 'error', msg: err instanceof Error ? err.message : 'ลบไม่สำเร็จ' }),
    })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายชื่อพนักงาน</h1>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setActive('employees.add')}>
            <Icon name="plus" size={15} /> เพิ่มพนักงานใหม่
          </button>
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
          <SearchInput value={q} onChange={setQ} placeholder="ค้นหา: ชื่อ / เบอร์โทร / ID" />
          <FilterCheckGroup
            label="สถานะ"
            options={[
              { k: 'active', l: 'ทำงาน', color: 'var(--green)' },
              { k: 'leave', l: 'ลาออก', color: 'var(--red)' },
            ]}
            state={filterStatus as unknown as Record<string, boolean>}
            onChange={s => setFilterStatus(s as unknown as FilterStatus)}
          />
        </div>

        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>เลขที่ ID</th>
                <th>ชื่อ-สกุล</th>
                <th>ตำแหน่ง</th>
                <th>เบอร์โทร</th>
                <th>Line</th>
                <th>วันเริ่มงาน</th>
                <th>ใบขับขี่</th>
                <th>สถานะ</th>
                <th>ดำเนิน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr
                  key={e.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSubject({ type: 'employee', id: e.id })
                  }}
                >
                  <td>
                    <span className="mono" style={{ fontWeight: 600 }}>{e.code}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{e.name}</td>
                  <td>
                    <div>{e.position}</div>
                    {isDriverPosition(e.position) && (() => {
                      const vs = allVehicles.filter(v => v.driverId === e.id)
                      if (vs.length === 0) return (
                        <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>ยังไม่ได้กำหนดรถ</div>
                      )
                      return (
                        <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                          {vs.map(v => (
                            <span
                              key={v.id}
                              className="mono"
                              style={{
                                fontSize: 10.5, padding: '1px 6px', borderRadius: 4,
                                background: 'var(--primary-50, #EFF6FF)', color: 'var(--primary)',
                              }}
                            >{v.plate}</span>
                          ))}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="mono">{e.phone}</td>
                  <td>
                    <a style={{ color: 'var(--primary)' }}>{e.lineId}</a>
                  </td>
                  <td className="num muted">{e.joined ? db.thaiDate(e.joined) : '—'}</td>
                  <td>
                    <LicenseLabel status={e.licenseStatus} expire={e.licenseExpire} />
                  </td>
                  <td>
                    {e.status === 'leave' ? (
                      <StatusBadge status="leave" />
                    ) : (
                      <span className="badge green">
                        <span className="sdot green" />
                        ทำงาน
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        className="btn ghost icon sm"
                        onClick={ev => {
                          ev.stopPropagation()
                          setOpenMenuId(openMenuId === e.id ? null : e.id)
                        }}
                      >
                        <Icon name="more" size={16} />
                      </button>
                      {openMenuId === e.id && (
                        <ActionMenu
                          onClose={() => setOpenMenuId(null)}
                          onEdit={() => setEditingId(e.id)}
                          onChangeStatus={() => setStatusChangingId(e.id)}
                          onDelete={() => setDeletingId(e.id)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    ไม่พบรายการพนักงาน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingId && (() => {
        const emp = allEmployees.find(e => e.id === editingId)
        if (!emp) return null
        return (
          <EmployeeEditModal
            employee={emp}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null)
              setToast({ kind: 'success', msg: '✅ บันทึกข้อมูลเรียบร้อย' })
            }}
          />
        )
      })()}

      {statusChangingId && (() => {
        const emp = allEmployees.find(e => e.id === statusChangingId)
        if (!emp) return null
        return (
          <StatusChangeDialog
            employee={emp}
            onClose={() => setStatusChangingId(null)}
            onChanged={() => {
              setStatusChangingId(null)
            }}
          />
        )
      })()}

      {deletingId && deletingEmployee && (
        <ConfirmDialog
          title="⚠️ แน่ใจหรือ?"
          message={`ต้องการลบพนักงาน "${deletingEmployee.name}" ออกจากระบบ? การกระทำนี้ไม่สามารถยกเลิกได้`}
          confirmLabel="ลบพนักงาน"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
