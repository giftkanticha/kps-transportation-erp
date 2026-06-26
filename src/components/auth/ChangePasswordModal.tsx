import { useState } from 'react'
import { changeOwnPassword } from '../../lib/authActions'

interface Props {
  onClose: () => void
}

export function ChangePasswordModal({ onClose }: Props) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const save = async () => {
    setErr(null)
    if (pw.length < 6) return setErr('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
    if (pw !== pw2) return setErr('รหัสผ่านยืนยันไม่ตรงกัน')
    setBusy(true)
    try {
      await changeOwnPassword(pw)
      setDone(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="head"><h3>เปลี่ยนรหัสผ่าน</h3></div>
        <div className="body">
          {done ? (
            <div style={{ padding: '12px 14px', background: 'var(--green-50)', color: '#166534', borderRadius: 6, fontSize: 13 }}>
              ✅ เปลี่ยนรหัสผ่านสำเร็จ ครั้งต่อไปใช้รหัสใหม่
            </div>
          ) : (
            <>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>รหัสผ่านใหม่</label>
                <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" autoComplete="new-password" autoFocus />
              </div>
              <div className="field">
                <label>ยืนยันรหัสผ่านใหม่</label>
                <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
              </div>
              {err && (
                <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--red-50)', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
                  {err}
                </div>
              )}
            </>
          )}
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>{done ? 'ปิด' : 'ยกเลิก'}</button>
          {!done && (
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
