import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../components/ui'
import { Field } from '../../components/ui'

export function RegisterPage({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ email: '', displayName: '', phone: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr]  = useState('')
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value })); setErr('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.displayName || !form.password) { setErr('กรุณากรอกข้อมูลที่จำเป็น'); return }
    if (form.password !== form.confirm) { setErr('รหัสผ่านไม่ตรงกัน'); return }
    if (form.password.length < 6) { setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { display_name: form.displayName.trim(), phone: form.phone.trim() } },
      })
      if (error) throw new Error(error.message)
      setDone(true)
    } catch (ex) { setErr((ex as Error).message) }
    finally { setLoading(false) }
  }

  if (done) return (
    <div className="login-wrap">
      <div className="login-poster">
        <div className="brand-big"><div className="mark">K</div><div><div style={{ fontSize: 13, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase' }}>KPS Logistics</div><div style={{ fontSize: 16, fontWeight: 600 }}>Transportation ERP</div></div></div>
      </div>
      <div className="login-form" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>สมัครสำเร็จ!</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          บัญชีของคุณถูกสร้างแล้ว<br />กรุณารอการอนุมัติจาก Admin
        </p>
        <button className="btn primary" style={{ height: 38, justifyContent: 'center' }} onClick={onBack}>
          <Icon name="arrow-left" size={15} /> กลับหน้า Login
        </button>
      </div>
    </div>
  )

  return (
    <div className="login-wrap">
      <div className="login-poster">
        <div className="brand-big"><div className="mark">K</div><div><div style={{ fontSize: 13, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase' }}>KPS Logistics</div><div style={{ fontSize: 16, fontWeight: 600 }}>Transportation ERP</div></div></div>
        <div style={{ marginTop: 'auto' }}><h1>สมัครสมาชิก<br />พนักงาน KPS</h1><p style={{ marginTop: 18 }}>สร้างบัญชีเพื่อเข้าถึงระบบ ERP<br />บัญชีจะใช้งานได้หลัง Admin อนุมัติ</p></div>
      </div>
      <div className="login-form">
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>สมัครสมาชิก</h2>
        <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>กรอกข้อมูลเพื่อสร้างบัญชีใหม่</p>
        <form onSubmit={submit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Email *"><input type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" autoFocus /></Field>
          <Field label="ชื่อ-นามสกุล *"><input value={form.displayName} onChange={set('displayName')} placeholder="ชื่อจริง" /></Field>
          <Field label="เบอร์โทร"><input value={form.phone} onChange={set('phone')} placeholder="08x-xxx-xxxx" /></Field>
          <Field label="รหัสผ่าน *"><input type="password" value={form.password} onChange={set('password')} placeholder="อย่างน้อย 6 ตัวอักษร" /></Field>
          <Field label="ยืนยันรหัสผ่าน *"><input type="password" value={form.confirm} onChange={set('confirm')} placeholder="กรอกรหัสผ่านอีกครั้ง" /></Field>
          {err && <div style={{ background: 'var(--red-50)', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: 12.5 }}><Icon name="alert" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{err}</div>}
          <button type="submit" className="btn primary" style={{ height: 38, justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13 }}>
          <span className="muted">มีบัญชีแล้ว? </span>
          <button onClick={onBack} className="btn ghost" style={{ fontSize: 13, padding: '2px 8px' }}>เข้าสู่ระบบ</button>
        </div>
      </div>
    </div>
  )
}
