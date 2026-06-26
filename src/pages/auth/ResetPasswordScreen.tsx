import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ACTIVE_BACKEND } from '../../lib/backends'
import { resetPasswordWithToken } from '../../lib/authActions'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/ui'
import {
  pageStyle, logoStyle, cardStyle,
  labelStyle, inputStyle, primaryBtnStyle, errorBoxStyle,
} from './authTheme'

// Shown when supabase fires PASSWORD_RECOVERY — i.e. the user arrived via
// a password-reset email link and holds a temporary recovery session.
export function ResetPasswordScreen() {
  const { exitRecovery, logout, resetToken } = useAuth()
  const [pw, setPw]     = useState('')
  const [pw2, setPw2]   = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 6) { setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (pw !== pw2)    { setErr('รหัสผ่านยืนยันไม่ตรงกัน'); return }
    setErr(''); setBusy(true)
    try {
      if (ACTIVE_BACKEND === 'mysql') {
        if (!resetToken) throw new Error('ลิงก์รีเซตไม่ถูกต้องหรือหมดอายุ')
        await resetPasswordWithToken(resetToken, pw)
      } else {
        const { error } = await supabase.auth.updateUser({ password: pw })
        if (error) throw new Error(error.message)
      }
      setDone(true)
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const goLogin = async () => {
    try { await logout() } catch { /* ignore */ }
    exitRecovery()
  }

  return (
    <div style={pageStyle}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={logoStyle}><Icon name="truck" size={36} /></div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>
          KPS Transportations
        </h1>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B' }}>ตั้งรหัสผ่านใหม่</div>

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
                เปลี่ยนรหัสผ่านสำเร็จ
              </h2>
              <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 22px', lineHeight: 1.6 }}>
                ครั้งต่อไปกรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
              </p>
              <button type="button" onClick={goLogin} style={{ ...primaryBtnStyle, marginTop: 0, width: '100%' }}>
                เข้าสู่ระบบ
              </button>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                ลิงก์รีเซตรหัสผ่านยืนยันแล้ว — ตั้งรหัสผ่านใหม่เพื่อเข้าใช้งานต่อ
              </div>
              <div>
                <label style={labelStyle}>รหัสผ่านใหม่</label>
                <input
                  type="password" value={pw} autoFocus autoComplete="new-password"
                  onChange={e => { setPw(e.target.value); setErr('') }}
                  placeholder="อย่างน้อย 6 ตัวอักษร" style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password" value={pw2} autoComplete="new-password"
                  onChange={e => { setPw2(e.target.value); setErr('') }}
                  style={inputStyle}
                />
              </div>
              {err && (
                <div style={errorBoxStyle}>
                  <Icon name="alert" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{err}
                </div>
              )}
              <button type="submit" disabled={busy} style={{
                ...primaryBtnStyle,
                background: busy ? '#9DDDC1' : primaryBtnStyle.background,
                cursor: busy ? 'default' : 'pointer',
              }}>
                {busy ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
