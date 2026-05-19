import { useState, useEffect, useCallback } from 'react'
import { api, type ApiUser } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/ui'

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] as const
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee',
}
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'var(--red)', ADMIN: 'var(--primary)', MANAGER: 'var(--amber)', EMPLOYEE: 'var(--text-muted)',
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'ใช้งาน', INACTIVE: 'ปิด', PENDING_APPROVAL: 'รออนุมัติ', LOCKED: 'ล็อค',
}
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'var(--green)', INACTIVE: 'var(--text-muted)', PENDING_APPROVAL: 'var(--amber)', LOCKED: 'var(--red)',
}

const CATEGORIES = [
  { key: 'FLEET_MANAGEMENT', label: 'จัดการรถ/คนขับ' },
  { key: 'TIRE_LIFECYCLE', label: 'ระบบยาง' },
  { key: 'FUEL_EXPENSES', label: 'ระบบน้ำมัน/ค่าใช้จ่าย' },
  { key: 'PARTNER_FINANCIALS', label: 'คู่ค้า/การเงิน' },
  { key: 'USER_MANAGEMENT', label: 'จัดการผู้ใช้' },
]
const ACTION_LEVELS = [
  { key: 'VIEW', label: 'ดู' },
  { key: 'CREATE', label: 'สร้าง' },
  { key: 'EDIT', label: 'แก้ไข' },
  { key: 'DELETE_APPROVE', label: 'ลบ/อนุมัติ' },
]

export function UserManagementPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState<'pending' | 'all' | 'audit'>('pending')
  const [users, setUsers] = useState<ApiUser[]>([])
  const [pending, setPending] = useState<ApiUser[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null)
  const [userPerms, setUserPerms] = useState<any[]>([])
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [all, pend] = await Promise.all([api.acl.listUsers(), api.acl.listUsers('PENDING_APPROVAL')])
      setUsers(all)
      setPending(pend)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAudit = useCallback(async () => {
    try {
      const result = await api.acl.auditLog()
      setAudit(result.logs)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'audit') loadAudit() }, [tab, loadAudit])

  const loadUserPerms = async (user: ApiUser) => {
    setSelectedUser(user)
    try {
      const perms = await api.acl.getPermissions(user.id)
      setUserPerms(perms)
    } catch { setUserPerms([]) }
  }

  const approve = async (userId: string) => {
    try { await api.acl.approve(userId); showToast('✅ อนุมัติสำเร็จ'); load() } catch (e) { showToast('❌ ' + (e as Error).message) }
  }
  const reject = async (userId: string) => {
    if (!confirm('ยืนยันปฏิเสธการสมัคร? ข้อมูลจะถูกลบออก')) return
    try { await api.acl.reject(userId); showToast('✅ ปฏิเสธแล้ว'); load() } catch (e) { showToast('❌ ' + (e as Error).message) }
  }
  const deactivate = async (userId: string) => {
    try { await api.acl.deactivate(userId); showToast('✅ ปิดบัญชีแล้ว'); load() } catch (e) { showToast('❌ ' + (e as Error).message) }
  }
  const activate = async (userId: string) => {
    try { await api.acl.activate(userId); showToast('✅ เปิดบัญชีแล้ว'); load() } catch (e) { showToast('❌ ' + (e as Error).message) }
  }
  const changeRole = async (userId: string, role: string) => {
    try { await api.acl.changeRole(userId, role); showToast('✅ เปลี่ยน role แล้ว'); load(); if (selectedUser?.id === userId) loadUserPerms({ ...selectedUser, role: role as any }) } catch (e) { showToast('❌ ' + (e as Error).message) }
  }
  const togglePerm = async (userId: string, cat: string, level: string, has: boolean) => {
    try {
      if (has) await api.acl.revokePermission(userId, cat, level)
      else await api.acl.grantPermission(userId, cat, level)
      if (selectedUser) loadUserPerms(selectedUser)
    } catch (e) { showToast('❌ ' + (e as Error).message) }
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#1a1a2e', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
          {toast}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการผู้ใช้งาน</h1>
          <div className="page-sub">อนุมัติ/ปฏิเสธ สิทธิ์การใช้งาน และ Audit Log</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 22 }}>
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          รออนุมัติ {pending.length > 0 && <span style={{ marginLeft: 6, background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{pending.length}</span>}
        </button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>ผู้ใช้ทั้งหมด</button>
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit Log</button>
      </div>

      {loading && <div className="card pad" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>กำลังโหลด...</div>}

      {/* Pending approvals */}
      {tab === 'pending' && !loading && (
        <div className="card">
          <div className="head"><h3>รอการอนุมัติ ({pending.length})</h3></div>
          {pending.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Icon name="check" size={32} style={{ opacity: .2, display: 'block', margin: '0 auto 8px' }} />
              ไม่มีการสมัครรอดำเนินการ
            </div>
          ) : (
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="tbl">
                <thead><tr><th>ชื่อ</th><th>Username</th><th>Email</th><th>สมัครเมื่อ</th><th className="center">ดำเนินการ</th></tr></thead>
                <tbody>
                  {pending.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.displayName}</td>
                      <td className="mono">{u.username}</td>
                      <td className="muted">{u.email || '—'}</td>
                      <td className="muted">{new Date(u.createdAt!).toLocaleDateString('th-TH')}</td>
                      <td className="center">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn sm primary" onClick={() => approve(u.id)}>✅ อนุมัติ</button>
                          <button className="btn sm" style={{ color: 'var(--red)' }} onClick={() => reject(u.id)}>❌ ปฏิเสธ</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All users */}
      {tab === 'all' && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 380px' : '1fr', gap: 18 }}>
          <div className="card">
            <div className="head"><h3>ผู้ใช้งานทั้งหมด ({users.length})</h3></div>
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="tbl">
                <thead><tr><th>ชื่อ</th><th>Username</th><th>Role</th><th>สถานะ</th><th>Login ล่าสุด</th><th className="center">จัดการ</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} onClick={() => loadUserPerms(u)} style={{ cursor: 'pointer', background: selectedUser?.id === u.id ? 'var(--primary-50)' : undefined }}>
                      <td style={{ fontWeight: 600 }}>{u.displayName}</td>
                      <td className="mono">{u.username}</td>
                      <td>
                        <span style={{ color: ROLE_COLORS[u.role], fontWeight: 600, fontSize: 12 }}>{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td>
                        <span style={{ color: STATUS_COLORS[u.status], fontWeight: 600, fontSize: 12 }}>{STATUS_LABELS[u.status] || u.status}</span>
                      </td>
                      <td className="muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('th-TH') : '—'}</td>
                      <td className="center" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {u.status === 'ACTIVE' ? (
                            <button className="btn sm" style={{ fontSize: 11 }} onClick={() => deactivate(u.id)}>ปิด</button>
                          ) : u.status !== 'PENDING_APPROVAL' ? (
                            <button className="btn sm primary" style={{ fontSize: 11 }} onClick={() => activate(u.id)}>เปิด</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User detail panel */}
          {selectedUser && (
            <div className="card" style={{ alignSelf: 'start' }}>
              <div className="head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{selectedUser.displayName}</h3>
                <button className="btn ghost icon sm" onClick={() => setSelectedUser(null)}><Icon name="close" size={14} /></button>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>@{selectedUser.username}</div>

                {/* Change role */}
                {isSuperAdmin && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 6 }}>บทบาท (Role)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ROLES.map(r => (
                        <button key={r} onClick={() => changeRole(selectedUser.id, r)}
                          style={{
                            fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontWeight: 600,
                            background: selectedUser.role === r ? ROLE_COLORS[r] : 'var(--bg-sunk)',
                            color: selectedUser.role === r ? '#fff' : 'var(--text-2)',
                            border: `1px solid ${selectedUser.role === r ? ROLE_COLORS[r] : 'var(--line)'}`,
                          }}>
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Permissions matrix */}
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8 }}>สิทธิ์การใช้งาน</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  ✦ = สิทธิ์เพิ่มเติม (override) &nbsp;|&nbsp; ✓ = จาก Role
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '3px 4px', color: 'var(--text-muted)' }}>หมวด</th>
                      {ACTION_LEVELS.map(a => <th key={a.key} style={{ textAlign: 'center', padding: '3px 4px', color: 'var(--text-muted)' }}>{a.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map(cat => (
                      <tr key={cat.key} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '4px', fontSize: 11 }}>{cat.label}</td>
                        {ACTION_LEVELS.map(act => {
                          const perm = userPerms.find(p => p.category === cat.key && p.actionLevel === act.key)
                          const has = !!perm
                          const isCustom = perm?.source === 'custom'
                          return (
                            <td key={act.key} style={{ textAlign: 'center', padding: '4px' }}>
                              <button onClick={() => togglePerm(selectedUser.id, cat.key, act.key, has)}
                                style={{
                                  width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: 'none',
                                  background: has ? (isCustom ? '#fef9c3' : '#dcfce7') : '#f1f5f9',
                                  color: has ? (isCustom ? '#854d0e' : '#166534') : '#cbd5e1',
                                }}>
                                {has ? (isCustom ? '✦' : '✓') : '·'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit log */}
      {tab === 'audit' && (
        <div className="card">
          <div className="head"><h3>Audit Log</h3></div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead><tr><th>วันที่</th><th>ผู้ดำเนินการ</th><th>Action</th><th>รายละเอียด</th></tr></thead>
              <tbody>
                {audit.map(log => (
                  <tr key={log.id}>
                    <td className="mono muted">{new Date(log.createdAt).toLocaleString('th-TH')}</td>
                    <td>{log.user?.displayName || log.userId || '—'}</td>
                    <td><span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 12 }}>{log.action}</span></td>
                    <td className="muted">{log.details || [log.category, log.actionLevel].filter(Boolean).join(':') || '—'}</td>
                  </tr>
                ))}
                {audit.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>ยังไม่มี log</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
