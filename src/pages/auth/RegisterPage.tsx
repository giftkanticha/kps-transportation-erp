import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../components/ui'
import {
  pageStyle, logoStyle, cardStyle,
  tabsContainerStyle, activeTabStyle, inactiveTabStyle,
  labelStyle, inputStyle, primaryBtnStyle, errorBoxStyle,
} from './authTheme'

export function RegisterPage({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ email: '', username: '', displayName: '', phone: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value })); setErr('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.username || !form.displayName || !form.password) {
      setErr('กรุณากรอกข้อมูลที่จำเป็น'); return
    }
    if (!/^[a-z0-9_.]{3,}$/.test(form.username.trim().toLowerCase())) {
      setErr('ชื่อผู้ใช้ต้องยาว ≥ 3 ตัว (a-z, 0-9, _ . เท่านั้น)'); return
    }
    if (form.password !== form.confirm) { setErr('รหัสผ่านไม่ตรงกัน'); return }
    if (form.password.length < 6) { setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            display_name: form.displayName.trim(),
            phone: form.phone.trim(),
            username: form.username.trim().toLowerCase(),
          },
        },
      })
      if (error) throw new Error(error.message)
      // Supabase returns status 200 even when the email is already in use
      // (anti-enumeration). The signal is data.user.identities being empty —
      // a real signup always has at least one identity entry. Without this
      // check the UI showed 'สมัครสำเร็จ' but no auth.users row was created,
      // so the new_user trigger never fired and the admin saw no approval
      // request.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error('อีเมลนี้ถูกใช้สมัครไปแล้ว — กรุณาเข้าสู่ระบบ หรือใช้ "ลืมรหัสผ่าน" เพื่อตั้งใหม่')
      }
      setDone(true)
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        {/* Logo */}
        <div style={logoStyle}>
          <Icon name="truck" size={36} />
        </div>

        {/* Title */}
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>
          KPS Transportations
        </h1>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B' }}>
          ระบบบริหารงานขนส่ง
        </div>

        {/* Card */}
        <div style={cardStyle}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div
                style={{
                  width: 60, height: 60, margin: '0 auto 14px',
                  background: '#DCFCE7', color: '#16A34A',
                  borderRadius: '50%', display: 'grid', placeItems: 'center',
                }}
              >
                <Icon name="check" size={30} />
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px', color: '#0F172A' }}>
                สมัครสำเร็จ
              </h2>
              <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 22px', lineHeight: 1.6 }}>
                บัญชีของคุณถูกสร้างแล้ว<br />กรุณารอ Admin อนุมัติก่อนเข้าใช้งาน
              </p>
              <button type="button" onClick={onBack} style={{ ...primaryBtnStyle, marginTop: 0, width: '100%' }}>
                กลับหน้าเข้าสู่ระบบ
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div style={tabsContainerStyle}>
                <button type="button" onClick={onBack} style={inactiveTabStyle}>เข้าสู่ระบบ</button>
                <button type="button" style={activeTabStyle}>สมัครสมาชิก</button>
              </div>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" value={form.email} onChange={set('email')} autoFocus autoComplete="email" style={inputStyle} placeholder="email@example.com" />
                </div>
                <div>
                  <label style={labelStyle}>ชื่อผู้ใช้ (สำหรับ login) *</label>
                  <input value={form.username} onChange={set('username')} autoComplete="username" style={inputStyle} placeholder="เช่น somchai" />
                </div>
                <div>
                  <label style={labelStyle}>ชื่อ-นามสกุล *</label>
                  <input value={form.displayName} onChange={set('displayName')} style={inputStyle} placeholder="ชื่อจริง" />
                </div>
                <div>
                  <label style={labelStyle}>เบอร์โทร</label>
                  <input value={form.phone} onChange={set('phone')} style={inputStyle} placeholder="08x-xxx-xxxx" />
                </div>
                <div>
                  <label style={labelStyle}>รหัสผ่าน *</label>
                  <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" style={inputStyle} placeholder="อย่างน้อย 6 ตัวอักษร" />
                </div>
                <div>
                  <label style={labelStyle}>ยืนยันรหัสผ่าน *</label>
                  <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" style={inputStyle} placeholder="กรอกรหัสผ่านอีกครั้ง" />
                </div>

                {err && (
                  <div style={errorBoxStyle}>
                    <Icon name="alert" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{err}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{
                  ...primaryBtnStyle,
                  background: loading ? '#9DDDC1' : primaryBtnStyle.background,
                  cursor: loading ? 'default' : 'pointer',
                }}>
                  {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
