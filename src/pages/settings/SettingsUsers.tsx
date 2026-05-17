import React, { useState } from 'react'
import { db } from '../../lib/db'
import { Icon, Field } from '../../components/ui'
import type { User, KPSRole } from '../../types'

interface UserForm {
  name: string
  email: string
  role: KPSRole
  phone: string
  title: string
  avatar: string
}

function Modal({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  footer: React.ReactNode
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <div style={{ flex: 1 }} />
          <button className="btn ghost icon sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  )
}

export function SettingsUsers() {
  const users = db.getAll<User>('users')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState<UserForm>({
    name: '',
    email: '',
    role: 'manager',
    phone: '',
    title: '',
    avatar: '',
  })

  const save = () => {
    if (!form.name || !form.email) {
      alert('กรุณากรอกชื่อและอีเมล')
      return
    }
    db.add<User>('users', {
      ...form,
      id: '',
      avatar: form.avatar || form.name.slice(0, 2),
    })
    setShow(false)
    setForm({ name: '', email: '', role: 'manager', phone: '', title: '', avatar: '' })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการผู้ใช้งาน</h1>
          <div className="page-sub">{users.length} บัญชีในระบบ</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShow(true)}>
            <Icon name="plus" size={15} /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>ชื่อ-อีเมล</th>
              <th>ตำแหน่ง</th>
              <th>โทร</th>
              <th>สิทธิ์</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <div
                      className={`avatar ${u.role === 'admin' ? 'violet' : u.role === 'driver' ? 'amber' : ''}`}
                    >
                      {u.avatar}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {u.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{u.title}</td>
                <td className="mono muted">{u.phone}</td>
                <td>
                  <span className={`role-pill ${u.role}`}>{u.role}</span>
                </td>
                <td>
                  <button className="btn ghost icon sm">
                    <Icon name="more" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="เพิ่มผู้ใช้ใหม่"
        footer={
          <>
            <button className="btn" onClick={() => setShow(false)}>
              ยกเลิก
            </button>
            <button className="btn primary" onClick={save}>
              บันทึก
            </button>
          </>
        }
      >
        <div className="grid-2">
          <Field label="ชื่อ-นามสกุล *">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="อีเมล *">
            <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="เบอร์โทร">
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="ตำแหน่ง">
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="สิทธิ์การเข้าถึง">
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as KPSRole }))}
            >
              <option value="admin">Admin — เข้าถึงทุกอย่าง</option>
              <option value="manager">Manager — จัดการขนส่ง</option>
              <option value="driver">Driver — งานของตนเอง</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
