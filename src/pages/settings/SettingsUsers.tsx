import { useState } from 'react'
import { useList, useUpdate } from '../../hooks/useTable'
import { useAuth } from '../../context/AuthContext'

interface Profile {
  id: string
  display_name: string
  username: string | null
  phone: string
  role: string
  status: string
  created_at: string
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] as const
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด', ADMIN: 'ผู้ดูแลระบบ', MANAGER: 'ผู้จัดการ', EMPLOYEE: 'พนักงาน',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'รออนุมัติ', ACTIVE: 'ใช้งาน', INACTIVE: 'ปิดใช้งาน', LOCKED: 'ถูกล็อก',
}
const STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: 'amber', ACTIVE: 'green', INACTIVE: 'gray', LOCKED: 'red',
}

export function SettingsUsers() {
  const { profile, isAdmin } = useAuth()
  const { data: users = [], isLoading } = useList<Profile>('user_profiles')
  const updateProfile = useUpdate<Profile>('user_profiles')
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (id: string, patch: Partial<Profile>) => {
    setBusy(id)
    try { await updateProfile.mutateAsync({ id, patch }) }
    catch (e) { alert(e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ') }
    finally { setBusy(null) }
  }

  if (!isAdmin) {
    return (
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการผู้ใช้งาน</h1>
          <div className="page-sub">เฉพาะผู้ดูแลระบบเท่านั้น</div>
        </div>
      </div>
    )
  }

  const pending = users.filter(u => u.status === 'PENDING_APPROVAL').length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการผู้ใช้งาน</h1>
          <div className="page-sub">
            {users.length} บัญชี{pending > 0 ? ` · ${pending} รออนุมัติ` : ''}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '10px 14px', fontSize: 13, color: 'var(--text-2)' }}>
        💡 ผู้ใช้สมัครเองที่หน้าเข้าสู่ระบบ → สถานะ “รออนุมัติ” → กดอนุมัติที่นี่เพื่อเปิดใช้งาน และกำหนดสิทธิ์ได้
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>ผู้ใช้</th>
              <th>ชื่อผู้ใช้ (login)</th>
              <th>โทร</th>
              <th>สิทธิ์</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const self = u.id === profile?.id
              const disabled = self || busy === u.id
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>
                    {u.display_name}
                    {self && <span className="muted" style={{ fontSize: 11 }}> (คุณ)</span>}
                  </td>
                  <td className="mono muted">{u.username ?? '—'}</td>
                  <td className="mono muted">{u.phone || '—'}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={disabled}
                      onChange={e => act(u.id, { role: e.target.value })}
                      style={{ fontSize: 12, padding: '3px 6px' }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[u.status] ?? 'gray'}`}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {u.status === 'PENDING_APPROVAL' && (
                        <button className="btn primary sm" disabled={busy === u.id} onClick={() => act(u.id, { status: 'ACTIVE' })}>
                          อนุมัติ
                        </button>
                      )}
                      {u.status === 'ACTIVE' && !self && (
                        <button className="btn sm" disabled={busy === u.id} onClick={() => act(u.id, { status: 'INACTIVE' })}>
                          ปิดใช้งาน
                        </button>
                      )}
                      {(u.status === 'INACTIVE' || u.status === 'LOCKED') && (
                        <button className="btn sm" disabled={busy === u.id} onClick={() => act(u.id, { status: 'ACTIVE' })}>
                          เปิดใช้งาน
                        </button>
                      )}
                      {self && u.status === 'ACTIVE' && <span className="muted" style={{ fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>ไม่มีผู้ใช้</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
