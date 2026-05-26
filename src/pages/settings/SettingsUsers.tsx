import { useState } from 'react'
import { useList, useUpdate, useDelete } from '../../hooks/useTable'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../components/ui'

interface Profile {
  id: string
  display_name: string
  username: string | null
  email: string | null
  phone: string
  role: string
  status: string
  created_at: string
}

function thaiShortDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()]} ${(d.getFullYear() + 543).toString().slice(-2)}`
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

// Role pill colors (matching the .badge palette in src/styles/index.css)
const ROLE_TONE: Record<string, { bg: string; fg: string; chevron: string }> = {
  SUPER_ADMIN: { bg: '#FEE2E2', fg: '#991B1B', chevron: '%23991B1B' },
  ADMIN:       { bg: '#DBEAFE', fg: '#1D4ED8', chevron: '%231D4ED8' },
  MANAGER:     { bg: '#FEF3C7', fg: '#92400E', chevron: '%2392400E' },
  EMPLOYEE:    { bg: '#F1F5F9', fg: '#475569', chevron: '%23475569' },
}

const rolePillStyle = (role: string, disabled: boolean) => {
  const t = ROLE_TONE[role] ?? ROLE_TONE.EMPLOYEE
  return {
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    MozAppearance: 'none' as const,
    background: `${t.bg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='${t.chevron}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M1 1l4 4 4-4'/></svg>") no-repeat right 10px center`,
    color: t.fg,
    border: 'none',
    borderRadius: 999,
    padding: '5px 26px 5px 12px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    minWidth: 130,
  }
}

export function SettingsUsers() {
  const { profile, isAdmin } = useAuth()
  const { data: users = [], isLoading } = useList<Profile>('user_profiles')
  const updateProfile = useUpdate<Profile>('user_profiles')
  const deleteProfile = useDelete('user_profiles')
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<Profile | null>(null)

  const act = async (id: string, patch: Partial<Profile>) => {
    setBusy(id)
    try { await updateProfile.mutateAsync({ id, patch }) }
    catch (e) { alert(e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ') }
    finally { setBusy(null) }
  }

  const del = async (id: string, name: string) => {
    if (!confirm(`ลบผู้ใช้ "${name}" ออกจากระบบถาวร?\n(บัญชี auth ใน Supabase จะคงอยู่ — admin ลบเพิ่มได้ที่ Supabase Studio ถ้าต้องการ)`)) return
    setBusy(id)
    try { await deleteProfile.mutateAsync(id) }
    catch (e) { alert(e instanceof Error ? e.message : 'ลบไม่สำเร็จ') }
    finally { setBusy(null) }
  }

  const sendReset = async (id: string, email: string | null, name: string) => {
    if (!email) { alert('ผู้ใช้นี้ไม่มีอีเมลในระบบ ส่งลิงก์รีเซตไม่ได้'); return }
    if (!confirm(`ส่งลิงก์รีเซตรหัสผ่านให้ ${name} (${email})?`)) return
    setBusy(id)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw new Error(error.message)
      alert(`ส่งลิงก์ไปที่ ${email} แล้ว — แจ้งให้ตรวจอีเมลและคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ส่งลิงก์ไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
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
              <th>อีเมล</th>
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
                    <div className="muted" style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>
                      สมัคร {thaiShortDate(u.created_at)}
                    </div>
                  </td>
                  <td className="mono muted">{u.username ?? '—'}</td>
                  <td className="mono muted" style={{ fontSize: 12 }}>{u.email ?? '—'}</td>
                  <td className="mono muted">{u.phone || '—'}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={disabled}
                      onChange={e => act(u.id, { role: e.target.value })}
                      style={rolePillStyle(u.role, disabled)}
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
                      <button
                        className="btn ghost icon sm"
                        title="แก้ไขโปรไฟล์"
                        onClick={() => setEditing(u)}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      {!self && (
                        <button
                          className="btn ghost icon sm"
                          title="ส่งลิงก์รีเซตรหัสผ่าน"
                          disabled={busy === u.id || !u.email}
                          onClick={() => sendReset(u.id, u.email, u.display_name)}
                        >
                          <Icon name="mail" size={14} />
                        </button>
                      )}
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
                        <>
                          <button className="btn sm" disabled={busy === u.id} onClick={() => act(u.id, { status: 'ACTIVE' })}>
                            เปิดใช้งาน
                          </button>
                          {!self && (
                            <button className="btn sm danger" disabled={busy === u.id} onClick={() => del(u.id, u.display_name)}>
                              <Icon name="trash" size={13} /> ลบผู้ใช้
                            </button>
                          )}
                        </>
                      )}
                      {self && u.status === 'ACTIVE' && <span className="muted" style={{ fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>ไม่มีผู้ใช้</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditProfileModal
          user={editing}
          isSelf={editing.id === profile?.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function EditProfileModal({ user, isSelf, onClose }: {
  user: Profile
  isSelf: boolean
  onClose: () => void
}) {
  const updateProfile = useUpdate<Profile>('user_profiles')
  const [displayName, setDisplayName] = useState(user.display_name)
  const [username, setUsername] = useState(user.username ?? '')
  const [email, setEmail] = useState(user.email ?? '')
  const [phone, setPhone] = useState(user.phone)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setErr(null)
    const u = username.trim().toLowerCase()
    const e = email.trim().toLowerCase()
    if (!displayName.trim()) return setErr('กรุณากรอกชื่อ-นามสกุล')
    if (u && !/^[a-z0-9_.]{3,}$/.test(u)) return setErr('ชื่อผู้ใช้ต้องเป็น a-z 0-9 _ . อย่างน้อย 3 ตัว')
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setErr('อีเมลไม่ถูกต้อง')
    if (isSelf && (pw || pw2)) {
      if (pw.length < 6) return setErr('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
      if (pw !== pw2) return setErr('รหัสผ่านยืนยันไม่ตรงกัน')
    }
    setBusy(true)
    try {
      // Email changes require updating auth.users too — done by an admin-only
      // SECURITY DEFINER RPC. Profile-only fields go through the normal update.
      const emailChanged = e !== (user.email ?? '').toLowerCase()
      if (emailChanged) {
        const { error } = await supabase.rpc('admin_set_user_email', {
          p_user_id: user.id,
          p_email:   e,
        })
        if (error) throw new Error(error.message)
      }
      await updateProfile.mutateAsync({
        id: user.id,
        patch: {
          display_name: displayName.trim(),
          username: u || null,
          phone: phone.trim(),
        } as Partial<Profile>,
      })
      if (isSelf && pw) {
        const { error } = await supabase.auth.updateUser({ password: pw })
        if (error) throw new Error(error.message)
      }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="head"><h3>แก้ไขข้อมูลผู้ใช้</h3></div>
        <div className="body">
          <div className="field" style={{ marginBottom: 14 }}>
            <label>ชื่อ-นามสกุล *</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>ชื่อผู้ใช้ (login)</label>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="เช่น somchai" autoComplete="username" />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>อีเมล *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" autoComplete="email" />
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>ใช้สำหรับเข้าระบบและรับลิงก์รีเซตรหัสผ่าน</div>
          </div>
          <div className="field" style={{ marginBottom: 4 }}>
            <label>เบอร์โทร</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          {isSelf && (
            <>
              <div style={{ borderTop: '1px solid var(--line)', margin: '20px 0 14px' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>เปลี่ยนรหัสผ่าน</div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}>เว้นว่างถ้าไม่ต้องการเปลี่ยน</div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>รหัสผ่านใหม่</label>
                <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" autoComplete="new-password" />
              </div>
              <div className="field">
                <label>ยืนยันรหัสผ่านใหม่</label>
                <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
              </div>
            </>
          )}
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
