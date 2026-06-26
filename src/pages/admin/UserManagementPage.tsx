import { useState, useEffect, useCallback } from 'react'
import { supabase, type UserProfile, type UserRole } from '../../lib/supabase'
import { ACTIVE_BACKEND } from '../../lib/backends'
import { api } from '../../lib/backends/mysql/api'
import { loadAclUsers } from '../../lib/aclUsers'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/ui'

const ROLES: UserRole[] = ['SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE']
const ROLE_LABELS: Record<string, string> = { SUPER_ADMIN:'Super Admin', ADMIN:'Admin', MANAGER:'Manager', EMPLOYEE:'Employee' }
const ROLE_COLORS: Record<string, string> = { SUPER_ADMIN:'var(--red)', ADMIN:'var(--primary)', MANAGER:'var(--amber)', EMPLOYEE:'var(--text-muted)' }
const STATUS_LABELS: Record<string, string> = { ACTIVE:'ใช้งาน', INACTIVE:'ปิด', PENDING_APPROVAL:'รออนุมัติ', LOCKED:'ล็อค' }
const STATUS_COLORS: Record<string, string> = { ACTIVE:'var(--green)', INACTIVE:'var(--text-muted)', PENDING_APPROVAL:'var(--amber)', LOCKED:'var(--red)' }

const CATEGORIES = [
  { key:'FLEET_MANAGEMENT',   label:'จัดการรถ/คนขับ' },
  { key:'TIRE_LIFECYCLE',     label:'ระบบยาง' },
  { key:'FUEL_EXPENSES',      label:'น้ำมัน/ค่าใช้จ่าย' },
  { key:'PARTNER_FINANCIALS', label:'คู่ค้า/การเงิน' },
  { key:'USER_MANAGEMENT',    label:'จัดการผู้ใช้' },
]
const ACTION_LEVELS = [
  { key:'VIEW', label:'ดู' }, { key:'CREATE', label:'สร้าง' },
  { key:'EDIT', label:'แก้ไข' }, { key:'DELETE_APPROVE', label:'ลบ/อนุมัติ' },
]

interface AuditRow { id: string; action: string; category?: string; details?: string; created_at: string; actor_id?: string }

export function UserManagementPage() {
  const { profile: myProfile, isSuperAdmin } = useAuth()
  const [tab, setTab]       = useState<'pending'|'all'|'audit'>('pending')
  const [users, setUsers]   = useState<UserProfile[]>([])
  const [pending, setPending] = useState<UserProfile[]>([])
  const [audit, setAudit]   = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [sel, setSel]       = useState<UserProfile | null>(null)
  const [perms, setPerms]   = useState<any[]>([])
  const [toast, setToast]   = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const log = async (action: string, targetId: string, details?: string) => {
    // In mysql mode, every ACL action logs its own audit entry server-side, so
    // there is no client-side audit write to perform.
    if (ACTIVE_BACKEND === 'mysql') return
    const { error } = await supabase.from('acl_audit_log').insert({ actor_id: myProfile?.id, target_id: targetId, action, details })
    if (error) console.warn('[acl_audit_log] write failed:', error.message)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const all = (await loadAclUsers()) as unknown as UserProfile[]
    setUsers(all)
    setPending(all.filter(u => u.status === 'PENDING_APPROVAL'))
    setLoading(false)
  }, [])

  const loadAudit = useCallback(async () => {
    if (ACTIVE_BACKEND === 'mysql') {
      const result = await api<{ logs: Array<{ id: string; action: string; category?: string; details?: string; createdAt: string; userId?: string }> }>('/api/acl/audit-log')
      setAudit(result.logs.map(l => ({
        id: l.id, action: l.action, category: l.category,
        details: l.details, created_at: l.createdAt, actor_id: l.userId,
      })))
      return
    }
    const { data } = await supabase.from('acl_audit_log').select('*').order('created_at', { ascending: false }).limit(100)
    setAudit((data || []) as AuditRow[])
  }, [])

  const loadPerms = useCallback(async (userId: string) => {
    if (ACTIVE_BACKEND === 'mysql') {
      const data = await api<Array<{ category: string; actionLevel: string }>>(`/api/acl/users/${userId}/permissions`)
      // The page reads perms via `p.action_level`; map camelCase → snake_case.
      setPerms((data || []).map(p => ({ category: p.category, action_level: p.actionLevel })))
      return
    }
    const { data } = await supabase.from('user_permissions').select('*').eq('user_id', userId)
    setPerms(data || [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'audit') loadAudit() }, [tab, loadAudit])

  const update = async (userId: string, patch: Partial<UserProfile>) => {
    const { error } = await supabase.from('user_profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', userId)
    if (error) throw new Error(error.message)
  }

  const approve = async (u: UserProfile) => {
    try {
      if (ACTIVE_BACKEND === 'mysql') {
        await api(`/api/acl/users/${u.id}/approve`, { method: 'POST' })
      } else {
        await update(u.id, { status: 'ACTIVE', approved_by: myProfile?.id, approved_at: new Date().toISOString() })
      }
      await log('USER_APPROVED', u.id)
      showToast('✅ อนุมัติสำเร็จ'); load()
    } catch (e) { showToast('❌ ' + (e as Error).message) }
  }

  const reject = async (u: UserProfile) => {
    if (!confirm('ปฏิเสธ? บัญชีจะถูกปิด')) return
    try {
      if (ACTIVE_BACKEND === 'mysql') {
        await api(`/api/acl/users/${u.id}/reject`, { method: 'POST', body: { reason: '' } })
      } else {
        await update(u.id, { status: 'INACTIVE' })
      }
      await log('USER_REJECTED', u.id)
      showToast('✅ ปฏิเสธแล้ว'); load()
    } catch (e) { showToast('❌ ' + (e as Error).message) }
  }

  const toggleStatus = async (u: UserProfile) => {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      if (ACTIVE_BACKEND === 'mysql') {
        await api(`/api/acl/users/${u.id}/${next === 'ACTIVE' ? 'activate' : 'deactivate'}`, { method: 'POST' })
      } else {
        await update(u.id, { status: next })
      }
      await log(next === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', u.id)
      showToast('✅ อัปเดตแล้ว')
      if (sel?.id === u.id) setSel({ ...sel, status: next })
      load()
    } catch (e) { showToast('❌ ' + (e as Error).message) }
  }

  const changeRole = async (u: UserProfile, role: UserRole) => {
    try {
      if (ACTIVE_BACKEND === 'mysql') {
        await api(`/api/acl/users/${u.id}/role`, { method: 'POST', body: { role } })
      } else {
        await update(u.id, { role })
      }
      await log('ROLE_CHANGED', u.id, `${u.role} → ${role}`)
      showToast('✅ เปลี่ยน role แล้ว')
      if (sel?.id === u.id) setSel({ ...sel, role })
      loadPerms(u.id); load()
    } catch (e) { showToast('❌ ' + (e as Error).message) }
  }

  const togglePerm = async (userId: string, cat: string, level: string, has: boolean) => {
    if (ACTIVE_BACKEND === 'mysql') {
      if (has) {
        await api(`/api/acl/users/${userId}/revoke`, { method: 'POST', body: { category: cat, actionLevel: level } })
      } else {
        await api(`/api/acl/users/${userId}/grant`, { method: 'POST', body: { category: cat, actionLevel: level, remark: '' } })
      }
      // grant/revoke log their own audit entry server-side.
      loadPerms(userId)
      return
    }
    if (has) {
      await supabase.from('user_permissions').delete().eq('user_id', userId).eq('category', cat).eq('action_level', level)
      await log('PERMISSION_REVOKED', userId, `${cat}:${level}`)
    } else {
      await supabase.from('user_permissions').upsert({ user_id: userId, category: cat, action_level: level, granted_by: myProfile?.id })
      await log('PERMISSION_GRANTED', userId, `${cat}:${level}`)
    }
    loadPerms(userId)
  }

  return (
    <div>
      {toast && <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:'#1a1a2e', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, boxShadow:'0 4px 20px rgba(0,0,0,.25)' }}>{toast}</div>}

      <div className="page-head">
        <div><h1 className="page-title">จัดการผู้ใช้งาน</h1><div className="page-sub">อนุมัติ · สิทธิ์การใช้งาน · Audit Log</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 22 }}>
        <button className={`tab ${tab==='pending'?'active':''}`} onClick={() => setTab('pending')}>
          รออนุมัติ {pending.length > 0 && <span style={{ marginLeft:6, background:'var(--red)', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:11 }}>{pending.length}</span>}
        </button>
        <button className={`tab ${tab==='all'?'active':''}`} onClick={() => setTab('all')}>ผู้ใช้ทั้งหมด</button>
        <button className={`tab ${tab==='audit'?'active':''}`} onClick={() => setTab('audit')}>Audit Log</button>
      </div>

      {loading && <div className="card pad" style={{ textAlign:'center', color:'var(--text-muted)' }}>กำลังโหลด...</div>}

      {tab === 'pending' && !loading && (
        <div className="card">
          <div className="head"><h3>รอการอนุมัติ ({pending.length})</h3></div>
          {pending.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)' }}>ไม่มีการสมัครรอดำเนินการ</div>
          ) : (
            <div className="tbl-wrap" style={{ border:'none', borderRadius:0 }}>
              <table className="tbl">
                <thead><tr><th>ชื่อ</th><th>Email</th><th>สมัครเมื่อ</th><th className="center">ดำเนินการ</th></tr></thead>
                <tbody>
                  {pending.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight:600 }}>{u.display_name}</td>
                      <td className="muted">{u.id.slice(0,8)}…</td>
                      <td className="muted">{new Date(u.created_at).toLocaleDateString('th-TH')}</td>
                      <td className="center">
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <button className="btn sm primary" onClick={() => approve(u)}>✅ อนุมัติ</button>
                          <button className="btn sm" style={{ color:'var(--red)' }} onClick={() => reject(u)}>❌ ปฏิเสธ</button>
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

      {tab === 'all' && !loading && (
        <div style={{ display:'grid', gridTemplateColumns: sel ? '1fr 380px' : '1fr', gap:18 }}>
          <div className="card">
            <div className="head"><h3>ผู้ใช้ทั้งหมด ({users.length})</h3></div>
            <div className="tbl-wrap" style={{ border:'none', borderRadius:0 }}>
              <table className="tbl">
                <thead><tr><th>ชื่อ</th><th>Role</th><th>สถานะ</th><th>สร้างเมื่อ</th><th className="center">จัดการ</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} onClick={() => { setSel(u); loadPerms(u.id) }} style={{ cursor:'pointer', background: sel?.id===u.id ? 'var(--primary-50)' : undefined }}>
                      <td style={{ fontWeight:600 }}>{u.display_name}</td>
                      <td><span style={{ color:ROLE_COLORS[u.role], fontWeight:600, fontSize:12 }}>{ROLE_LABELS[u.role]}</span></td>
                      <td><span style={{ color:STATUS_COLORS[u.status], fontWeight:600, fontSize:12 }}>{STATUS_LABELS[u.status]||u.status}</span></td>
                      <td className="muted">{new Date(u.created_at).toLocaleDateString('th-TH')}</td>
                      <td className="center" onClick={e => e.stopPropagation()}>
                        {u.status === 'ACTIVE'
                          ? <button className="btn sm" style={{ fontSize:11 }} onClick={() => toggleStatus(u)}>ปิด</button>
                          : u.status !== 'PENDING_APPROVAL'
                            ? <button className="btn sm primary" style={{ fontSize:11 }} onClick={() => toggleStatus(u)}>เปิด</button>
                            : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {sel && (
            <div className="card" style={{ alignSelf:'start' }}>
              <div className="head" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h3 style={{ margin:0 }}>{sel.display_name}</h3>
                <button className="btn ghost icon sm" onClick={() => setSel(null)}><Icon name="close" size={14} /></button>
              </div>
              <div style={{ padding:'14px 18px' }}>
                {isSuperAdmin && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:6 }}>บทบาท</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {ROLES.map(r => (
                        <button key={r} onClick={() => changeRole(sel, r)}
                          style={{ fontSize:11, padding:'3px 10px', borderRadius:20, cursor:'pointer', fontWeight:600,
                            background: sel.role===r ? ROLE_COLORS[r] : 'var(--bg-sunk)',
                            color: sel.role===r ? '#fff' : 'var(--text-2)',
                            border: `1px solid ${sel.role===r ? ROLE_COLORS[r] : 'var(--line)'}` }}>
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-muted)', marginBottom:8 }}>สิทธิ์เพิ่มเติม (override)</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr><th style={{ textAlign:'left', padding:'3px 4px', color:'var(--text-muted)' }}>หมวด</th>
                    {ACTION_LEVELS.map(a => <th key={a.key} style={{ textAlign:'center', padding:'3px 4px', color:'var(--text-muted)' }}>{a.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map(cat => (
                      <tr key={cat.key} style={{ borderTop:'1px solid var(--line)' }}>
                        <td style={{ padding:'4px', fontSize:11 }}>{cat.label}</td>
                        {ACTION_LEVELS.map(act => {
                          const has = perms.some(p => p.category===cat.key && p.action_level===act.key)
                          return (
                            <td key={act.key} style={{ textAlign:'center', padding:'4px' }}>
                              <button onClick={() => togglePerm(sel.id, cat.key, act.key, has)}
                                style={{ width:22, height:22, borderRadius:4, cursor:'pointer', fontSize:12, fontWeight:700, border:'none',
                                  background: has ? '#dcfce7' : '#f1f5f9', color: has ? '#166534' : '#cbd5e1' }}>
                                {has ? '✓' : '·'}
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

      {tab === 'audit' && (
        <div className="card">
          <div className="head"><h3>Audit Log</h3></div>
          <div className="tbl-wrap" style={{ border:'none', borderRadius:0 }}>
            <table className="tbl">
              <thead><tr><th>วันที่</th><th>Action</th><th>รายละเอียด</th></tr></thead>
              <tbody>
                {audit.map(l => (
                  <tr key={l.id}>
                    <td className="mono muted">{new Date(l.created_at).toLocaleString('th-TH')}</td>
                    <td><span style={{ fontWeight:600, color:'var(--primary)', fontSize:12 }}>{l.action}</span></td>
                    <td className="muted">{l.details || '—'}</td>
                  </tr>
                ))}
                {audit.length===0 && <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--text-muted)', padding:32 }}>ยังไม่มี log</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
