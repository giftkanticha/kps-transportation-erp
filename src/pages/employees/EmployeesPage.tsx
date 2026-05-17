import { useState, useMemo, useRef, useEffect } from 'react'
import { db } from '../../lib/db'
import type { Employee } from '../../types'
import { Icon, StatusBadge } from '../../components/ui'

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

const TODAY = new Date('2026-05-17')

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
  // warning — show countdown
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
  employee: Employee
  onClose: () => void
  onEdit: () => void
  onChangeStatus: () => void
}

function ActionMenu({ employee, onClose, onEdit, onChangeStatus }: ActionMenuProps) {
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
        minWidth: 160,
        padding: '4px 0',
      }}
    >
      <button
        className="btn ghost"
        style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13 }}
        onClick={() => {
          onClose()
          onEdit()
        }}
      >
        <Icon name="edit" size={14} /> แก้ไขข้อมูล
      </button>
      <button
        className="btn ghost"
        style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: 'var(--amber)' }}
        onClick={() => {
          onClose()
          onChangeStatus()
        }}
      >
        <Icon name="refresh" size={14} /> เปลี่ยนสถานะ
      </button>
      <button
        className="btn ghost"
        style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: 'var(--red)' }}
        onClick={() => {
          onClose()
          const confirmed = confirm(`ยืนยันการลาออกของ ${employee.name}?`)
          if (confirmed) {
            db.update<Employee>('employees', employee.id, { status: 'leave' })
          }
        }}
      >
        <Icon name="close" size={14} /> ลาออก
      </button>
    </div>
  )
}

interface EmployeeEditModalProps {
  employee: Employee
  onClose: () => void
  onChanged: () => void
}

function EmployeeEditModal({ employee, onClose, onChanged }: EmployeeEditModalProps) {
  const [form, setForm] = useState({
    name: employee.name,
    position: employee.position,
    phone: employee.phone,
    lineId: employee.lineId,
    joined: employee.joined,
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.name || !form.phone) {
      alert('กรุณากรอกชื่อและเบอร์โทร')
      return
    }
    db.update<Employee>('employees', employee.id, {
      name: form.name,
      position: form.position,
      phone: form.phone,
      lineId: form.lineId,
      joined: form.joined,
    })
    onClose()
    onChanged()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: 12,
        width: '90%',
        maxWidth: 500,
        padding: 24,
        boxShadow: '0 10px 40px rgba(0,0,0,.2)',
      }}>
        <h2 style={{ margin: '0 0 18px 0', fontSize: 18, fontWeight: 600 }}>แก้ไขข้อมูลพนักงาน</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              เลขที่ ID
            </label>
            <input
              value={employee.code}
              readOnly
              style={{ width: '100%', background: 'var(--bg-2)', color: 'var(--text-muted)', cursor: 'default' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              ชื่อ-สกุล *
            </label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              ตำแหน่ง
            </label>
            <input
              value={form.position}
              onChange={e => set('position', e.target.value)}
              placeholder="เช่น คนขับ"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              เบอร์โทรศัพท์ *
            </label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="เช่น 0812345678"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              Line ID
            </label>
            <input
              value={form.lineId}
              onChange={e => set('lineId', e.target.value)}
              placeholder="เช่น @somchai"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>
              วันเริ่มงาน
            </label>
            <input
              type="date"
              value={form.joined}
              onChange={e => set('joined', e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn primary" onClick={save}>
            บันทึกการแก้ไข
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
  const changeStatus = (status: Employee['status']) => {
    db.update<Employee>('employees', employee.id, { status })
    onClose()
    onChanged()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: 12,
        width: '90%',
        maxWidth: 400,
        padding: 24,
        boxShadow: '0 10px 40px rgba(0,0,0,.2)',
      }}>
        <h2 style={{ margin: '0 0 18px 0', fontSize: 18, fontWeight: 600 }}>เปลี่ยนสถานะพนักงาน</h2>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-2)', fontSize: 14 }}>
          {employee.name}
        </p>
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
          <button className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

export function EmployeesPage({ setActive, setSubject }: EmployeesPageProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>({ active: true, leave: false })

  const inBucket = (e: Employee): boolean =>
    (filterStatus.active && (e.status === 'active' || e.status === 'training')) ||
    (filterStatus.leave && e.status === 'leave')

  const filtered = useMemo(() => {
    const employees = db.getAll<Employee>('employees')
    return employees.filter(e => {
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
  }, [tick, q, filterStatus])

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
              placeholder="ค้นหา: ชื่อ / เบอร์โทร / ID"
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
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {e.code}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{e.name}</td>
                  <td>{e.position}</td>
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
                          employee={e}
                          onClose={() => setOpenMenuId(null)}
                          onEdit={() => setEditingId(e.id)}
                          onChangeStatus={() => setStatusChangingId(e.id)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingId && (
        <EmployeeEditModal
          employee={filtered.find(e => e.id === editingId)!}
          onClose={() => setEditingId(null)}
          onChanged={() => {
            setEditingId(null)
            setTick(t => t + 1)
          }}
        />
      )}

      {statusChangingId && (
        <StatusChangeDialog
          employee={filtered.find(e => e.id === statusChangingId)!}
          onClose={() => setStatusChangingId(null)}
          onChanged={() => {
            setStatusChangingId(null)
            setTick(t => t + 1)
          }}
        />
      )}
    </div>
  )
}
