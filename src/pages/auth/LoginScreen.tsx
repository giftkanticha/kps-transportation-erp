import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/ui'
import { Field } from '../../components/ui'
import { RegisterPage } from './RegisterPage'

const DEMO = [
  { email: 'admin@kps.com',   label: 'KPS Administrator', role: 'SUPER_ADMIN' },
  { email: 'manager@kps.com', label: 'ผู้จัดการฝ่าย',       role: 'MANAGER' },
]

export function LoginScreen() {
  const { login, loading } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [err,      setErr]      = useState('')
  const [picked,   setPicked]   = useState<string | null>(null)
  const [showReg,  setShowReg]  = useState(false)

  if (showReg) return <RegisterPage onBack={() => setShowReg(false)} />

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!identifier) { setErr('กรุณากรอกชื่อผู้ใช้ หรืออีเมล'); return }
    if (!password)   { setErr('กรุณากรอกรหัสผ่าน'); return }
    setErr('')
    try { await login(identifier, password) }
    catch (ex) { setErr((ex as Error).message) }
  }

  return (
    <div className="login-wrap">
      <div className="login-poster">
        <div className="brand-big">
          <div className="mark">K</div>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase' }}>KPS Logistics</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Transportation ERP</div>
          </div>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <h1>ระบบจัดการการขนส่ง<br />ครบวงจร</h1>
          <p style={{ marginTop: 18 }}>จัดการรถ คนขับ ลูกค้า ทริปงาน การบำรุงรักษา และยาง ในที่เดียว</p>
          <div style={{ display: 'flex', gap: 32, marginTop: 40, fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
            <div><div className="mono" style={{ fontSize: 28, color: '#fff', fontWeight: 600 }}>7</div><div>คันรถ</div></div>
            <div><div className="mono" style={{ fontSize: 28, color: '#fff', fontWeight: 600 }}>8</div><div>คนขับ</div></div>
            <div><div className="mono" style={{ fontSize: 28, color: '#fff', fontWeight: 600 }}>10</div><div>ทริปสัปดาห์นี้</div></div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 56, bottom: 24, fontSize: 11.5, color: 'rgba(255,255,255,.4)' }}>© 2026 KPS Transportation Co., Ltd.</div>
      </div>

      <div className="login-form">
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>เข้าสู่ระบบ</h2>
        <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>ยินดีต้อนรับกลับ — กรุณาเข้าสู่ระบบ</p>

        <form onSubmit={submit} style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="ชื่อผู้ใช้ หรือ อีเมล">
            <input value={identifier} onChange={e => { setIdentifier(e.target.value); setErr('') }}
              placeholder="ชื่อผู้ใช้ หรือ you@kps.com" autoFocus autoComplete="username" />
          </Field>
          <Field label="รหัสผ่าน">
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setErr('') }}
              placeholder="••••••••" autoComplete="current-password" />
          </Field>

          {err && (
            <div style={{ background: 'var(--red-50)', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: 12.5 }}>
              <Icon name="alert" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{err}
            </div>
          )}

          <button type="submit" className="btn primary" style={{ height: 38, justifyContent: 'center', marginTop: 6 }} disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : <> เข้าสู่ระบบ <Icon name="arrow-right" size={15} /></>}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
          <span className="muted">ยังไม่มีบัญชี? </span>
          <button onClick={() => setShowReg(true)} className="btn ghost" style={{ fontSize: 13, padding: '2px 8px' }}>สมัครสมาชิก</button>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-sunk)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Demo accounts — คลิกเพื่อใช้</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO.map(d => (
              <div key={d.email} onClick={() => { setPicked(d.email); setIdentifier(d.email); setPassword('kps1234'); setErr('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                  background: picked === d.email ? '#fff' : 'transparent',
                  border: picked === d.email ? '1px solid var(--primary-600)' : '1px solid transparent' }}>
                <div className="avatar sm">{d.role === 'SUPER_ADMIN' ? '👑' : '📋'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{d.email}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{d.label}</div>
                </div>
                <span className={`role-pill ${d.role === 'SUPER_ADMIN' ? 'admin' : 'manager'}`}>{d.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Manager'}</span>
              </div>
            ))}
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>* password: kps1234</div>
        </div>
      </div>
    </div>
  )
}
