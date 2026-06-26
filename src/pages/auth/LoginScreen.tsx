import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { signOutEverywhere, requestPasswordReset } from '../../lib/authActions'
import { Icon } from '../../components/ui'
import { RegisterPage } from './RegisterPage'
import {
  pageStyle, logoStyle, cardStyle,
  tabsContainerStyle, activeTabStyle, inactiveTabStyle,
  labelStyle, inputStyle, primaryBtnStyle, outlineBtnStyle, errorBoxStyle,
} from './authTheme'

export function LoginScreen() {
  const { login, loading } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [err, setErr]               = useState('')
  const [showReg, setShowReg]       = useState(false)

  if (showReg) return <RegisterPage onBack={() => setShowReg(false)} />

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!identifier) { setErr('กรุณากรอกชื่อผู้ใช้งาน'); return }
    if (!password)   { setErr('กรุณากรอกรหัสผ่าน'); return }
    setErr('')
    try { await login(identifier, password) }
    catch (ex) { setErr((ex as Error).message) }
  }

  const forgot = async () => {
    const email = window.prompt('กรอกอีเมลที่ใช้สมัคร เพื่อรับลิงก์รีเซตรหัสผ่าน:')
    if (!email) return
    try {
      const r = await requestPasswordReset(email.trim())
      if (r.token) {
        // No SMTP configured — show the link so the user can proceed.
        window.prompt('ยังไม่ได้ตั้งค่าอีเมล (SMTP) — คัดลอกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:',
          `${window.location.origin}/?reset_token=${r.token}`)
      } else {
        alert(r.message)
      }
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : 'ส่งลิงก์ไม่สำเร็จ')
    }
  }

  const clearSession = async () => {
    await signOutEverywhere()
    try { localStorage.clear() } catch { /* ignore */ }
    window.location.reload()
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
          {/* Tabs */}
          <div style={tabsContainerStyle}>
            <button type="button" style={activeTabStyle}>เข้าสู่ระบบ</button>
            <button type="button" onClick={() => setShowReg(true)} style={inactiveTabStyle}>สมัครสมาชิก</button>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>ชื่อผู้ใช้งาน</label>
              <input
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); setErr('') }}
                autoFocus
                autoComplete="username"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErr('') }}
                autoComplete="current-password"
                style={inputStyle}
              />
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
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>

            <button type="button" onClick={forgot} style={{
              background: 'none', border: 'none', color: '#0ea371',
              fontSize: 12.5, cursor: 'pointer', marginTop: -6,
            }}>
              ลืมรหัสผ่าน?
            </button>

            <button type="button" onClick={clearSession} style={outlineBtnStyle}>
              <Icon name="refresh" size={14} /> ล้าง Session (แก้ปัญหาเข้าระบบไม่ได้)
            </button>
            <div style={{ textAlign: 'center', fontSize: 11.5, color: '#94A3B8', marginTop: -6 }}>
              ใช้เมื่อระบบค้าง / Token หมดอายุ / login ไม่ขึ้น
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

