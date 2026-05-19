import { useState } from 'react'
import { Icon } from '../../components/ui'
import { Field } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { RegisterPage } from './RegisterPage'

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin1234', display: 'KPS Administrator', role: 'SUPER_ADMIN' },
  { username: 'manager1', password: 'pass1234', display: 'ผู้จัดการฝ่าย', role: 'MANAGER' },
]

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee',
}

export function LoginScreen() {
  const { login, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)

  if (showRegister) return <RegisterPage onBack={() => setShowRegister(false)} />

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!username) { setErr('กรุณากรอก Username'); return }
    if (!password) { setErr('กรุณากรอก Password'); return }
    setErr('')
    try {
      await login(username, password)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const quickPick = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setPicked(acc.username)
    setUsername(acc.username)
    setPassword(acc.password)
    setErr('')
  }

  return (
    <div className="login-wrap">
      <div className="login-poster">
        <div className="brand-big">
          <div className="mark">K</div>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              KPS Logistics
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Transportation ERP</div>
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <h1>ระบบจัดการการขนส่ง<br />ครบวงจร</h1>
          <p style={{ marginTop: 18 }}>
            จัดการรถ คนขับ ลูกค้า ทริปงาน การบำรุงรักษา และยาง
            ในที่เดียว ติดตามทุกความเคลื่อนไหวแบบเรียลไทม์
          </p>

          <div style={{ display: 'flex', gap: 32, marginTop: 40, fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
            <div>
              <div className="mono" style={{ fontSize: 28, color: '#fff', fontWeight: 600 }}>7</div>
              <div>คันรถในระบบ</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 28, color: '#fff', fontWeight: 600 }}>8</div>
              <div>คนขับ</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 28, color: '#fff', fontWeight: 600 }}>10</div>
              <div>ทริปสัปดาห์นี้</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 56, bottom: 24, fontSize: 11.5, color: 'rgba(255,255,255,.4)' }}>
          © 2026 KPS Transportation Co., Ltd.
        </div>
      </div>

      <div className="login-form">
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>เข้าสู่ระบบ</h2>
        <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>ยินดีต้อนรับกลับ — กรุณาเข้าสู่ระบบ</p>

        <form onSubmit={submit} style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Username">
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setErr('') }}
              placeholder="กรอก username"
              autoFocus
              autoComplete="username"
            />
          </Field>
          <Field label="รหัสผ่าน / Password">
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErr('') }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>

          {err && (
            <div style={{ background: 'var(--red-50)', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: 12.5 }}>
              <Icon name="alert" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {err}
            </div>
          )}

          <button
            type="submit"
            className="btn primary"
            style={{ height: 38, justifyContent: 'center', marginTop: 6 }}
            disabled={loading}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : (
              <>เข้าสู่ระบบ <Icon name="arrow-right" size={15} /></>
            )}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
          <span className="muted">ยังไม่มีบัญชี? </span>
          <button onClick={() => setShowRegister(true)} className="btn ghost" style={{ fontSize: 13, padding: '2px 8px' }}>
            สมัครสมาชิก
          </button>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-sunk)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>
            Demo accounts — คลิกเพื่อใช้
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <div
                key={acc.username}
                onClick={() => quickPick(acc)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6,
                  background: picked === acc.username ? '#fff' : 'transparent',
                  border: picked === acc.username ? '1px solid var(--primary-600)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <div className="avatar sm">{acc.role === 'SUPER_ADMIN' ? '👑' : '📋'}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{acc.username}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{acc.display}</div>
                </div>
                <span className={`role-pill ${acc.role === 'SUPER_ADMIN' ? 'admin' : 'manager'}`}>
                  {ROLE_LABELS[acc.role]}
                </span>
              </div>
            ))}
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
            * คลิกเพื่อเลือก account แล้วกด "เข้าสู่ระบบ"
          </div>
        </div>
      </div>
    </div>
  )
}
