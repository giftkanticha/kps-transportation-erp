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
  onChanged: () => void
}

function ActionMenu({ employee, onClose, onChanged }: ActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const changeStatus = (status: Employee['status']) => {
    db.update<Employee>('employees', employee.id, { status })
    onClose()
    onChanged()
  }

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
        onClick={onClose}
      >
        <Icon name="edit" size={14} /> แก้ไขข้อมูล
      </button>
      {employee.status !== 'active' && (
        <button
          className="btn ghost"
          style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: 'var(--green)' }}
          onClick={() => changeStatus('active')}
        >
          <Icon name="check" size={14} /> เปลี่ยนเป็น ทำงาน
        </button>
      )}
      {employee.status !== 'training' && (
        <button
          className="btn ghost"
          style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: 'var(--amber)' }}
          onClick={() => changeStatus('training')}
        >
          <Icon name="check" size={14} /> เปลี่ยนเป็น อบรม
        </button>
      )}
      {employee.status !== 'leave' && (
        <button
          className="btn ghost"
          style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', fontSize: 13, color: 'var(--red)' }}
          onClick={() => changeStatus('leave')}
        >
          <Icon name="close" size={14} /> ลาออก
        </button>
      )}
    </div>
  )
}

export function EmployeesPage({ setActive, setSubject }: EmployeesPageProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
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
                          onChanged={() => setTick(t => t + 1)}
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
    </div>
  )
}
