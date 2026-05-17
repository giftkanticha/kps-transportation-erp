import { useState } from 'react'
import type { User } from '../../types'
import { db } from '../../lib/db'
import { Icon } from '../../components/ui'
import { Field } from '../../components/ui'

interface LoginScreenProps {
  onLogin: (user: User) => void
}

function roleLabel(r: string): string {
  if (r === 'admin') return 'Administrator'
  if (r === 'manager') return 'Manager'
  return 'Driver / Employee'
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

  const seedUsers = db.getAll<User>('users')

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!email) { setErr('กรุณากรอกอีเมล'); return }
    const u = db.login(email)
    if (!u) { setErr('ไม่พบผู้ใช้นี้ในระบบ'); return }
    onLogin(u)
  }

  const quickPick = (u: User) => {
    setPicked(u.id)
    setEmail(u.email)
    setPassword('••••••••')
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
          <Field label="อีเมล / Email">
            <input
              value={email}
              onChange={e => { setEmail(e.target.value); setErr('') }}
              placeholder="you@kps.com"
              autoFocus
            />
          </Field>
          <Field label="รหัสผ่าน / Password">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
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
          >
            เข้าสู่ระบบ <Icon name="arrow-right" size={15} />
          </button>
        </form>

        <div style={{ marginTop: 28, padding: 16, background: 'var(--bg-sunk)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>
            Demo accounts — คลิกเพื่อใช้
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {seedUsers.map(u => (
              <div
                key={u.id}
                onClick={() => quickPick(u)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6,
                  background: picked === u.id ? '#fff' : 'transparent',
                  border: picked === u.id ? '1px solid var(--primary-600)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <div className="avatar sm">{u.avatar}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{u.email}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{u.name}</div>
                </div>
                <span className={`role-pill ${u.role}`}>{roleLabel(u.role)}</span>
              </div>
            ))}
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
            * โหมดเดโม — ไม่ต้องใส่รหัสผ่าน
          </div>
        </div>
      </div>
    </div>
  )
}
