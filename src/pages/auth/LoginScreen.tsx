import { useState, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../components/ui'
import { RegisterPage } from './RegisterPage'

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

  const clearSession = async () => {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
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
              <div style={{
                background: '#FEE2E2', color: '#991B1B',
                padding: '9px 12px', borderRadius: 8, fontSize: 12.5,
              }}>
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

// ─── styles ─────────────────────────────────────────────────────────────────
const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'radial-gradient(ellipse at top, #F0FDF4 0%, #ECFDF5 55%, #DCFCE7 100%)',
  padding: '40px 20px',
  fontFamily: 'var(--font-sans)',
}

const logoStyle: CSSProperties = {
  width: 76, height: 76, margin: '0 auto 18px',
  background: 'linear-gradient(135deg, #34D399, #059669)',
  borderRadius: 18,
  display: 'grid', placeItems: 'center',
  boxShadow: '0 10px 24px -8px rgba(16,185,129,.55)',
  color: '#fff',
}

const cardStyle: CSSProperties = {
  marginTop: 28,
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 12px 36px -12px rgba(15,23,42,.12), 0 4px 10px -4px rgba(15,23,42,.06)',
  padding: 26,
  textAlign: 'left',
}

const tabsContainerStyle: CSSProperties = {
  background: '#F1F5F9',
  borderRadius: 12,
  padding: 4,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
  marginBottom: 22,
}

const activeTabStyle: CSSProperties = {
  padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#fff', color: '#0F172A', fontWeight: 600, fontSize: 13.5,
  boxShadow: '0 1px 2px rgba(15,23,42,.08)', fontFamily: 'inherit',
}

const inactiveTabStyle: CSSProperties = {
  padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'transparent', color: '#64748B', fontWeight: 500, fontSize: 13.5,
  fontFamily: 'inherit',
}

const labelStyle: CSSProperties = {
  fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6,
}

const inputStyle: CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14,
  background: '#fff', color: '#0F172A', outline: 'none', fontFamily: 'inherit',
}

const primaryBtnStyle: CSSProperties = {
  marginTop: 6, height: 46, borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg, #34D399, #10B981)',
  color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
  fontFamily: 'inherit', boxShadow: '0 6px 14px -4px rgba(16,185,129,.45)',
}

const outlineBtnStyle: CSSProperties = {
  marginTop: 2, height: 44, borderRadius: 10,
  background: '#fff', color: '#475569', border: '1px solid #E2E8F0',
  fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}
