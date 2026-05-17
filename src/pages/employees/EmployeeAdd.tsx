import { useState } from 'react'
import { db } from '../../lib/db'
import type { Employee } from '../../types'
import { Icon, Field } from '../../components/ui'

interface EmployeeAddProps {
  setActive: (id: string) => void
}

interface EmployeeForm {
  code: string
  name: string
  position: string
  status: string
  phone: string
  lineId: string
  joined: string
  licenseStatus: string
}

export function EmployeeAdd({ setActive }: EmployeeAddProps) {
  const employees = db.getAll<Employee>('employees')
  const next = String(employees.length + 1).padStart(3, '0')

  const [form, setForm] = useState<EmployeeForm>({
    code: 'E' + next,
    name: '',
    position: 'คนขับ',
    status: 'active',
    phone: '',
    lineId: '',
    joined: '',
    licenseStatus: 'ok',
  })

  const set = (k: keyof EmployeeForm, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.name || !form.phone) {
      alert('กรุณากรอกชื่อและเบอร์โทร')
      return
    }
    db.add<Partial<Employee>>('employees', {
      ...form,
      licenseStatus: form.licenseStatus as Employee['licenseStatus'],
      license: '',
      licenseExpire: '',
      salary: 17000,
      vehicleId: null,
      idCard: '',
      accountBank: '',
      accountNo: '',
    })
    setActive('employees')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div
            className="row"
            style={{
              gap: 4,
              color: 'var(--text-muted)',
              fontSize: 14,
              marginBottom: 4,
              cursor: 'pointer',
            }}
            onClick={() => setActive('employees')}
          >
            <Icon name="arrow-right" size={15} style={{ transform: 'rotate(180deg)' }} />
            <span>รายชื่อพนักงาน</span>
          </div>
          <h1 className="page-title">เพิ่มพนักงานใหม่</h1>
          <div className="page-sub">บันทึกข้อมูลพนักงานเข้าระบบ</div>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        {/* Personal info */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="user" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลส่วนตัว</h3>
          </div>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลขที่ ID *">
              <input
                value={form.code}
                onChange={e => set('code', e.target.value)}
                placeholder="เช่น E003"
              />
            </Field>
            <Field label="ชื่อ-สกุล *">
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
              />
            </Field>
            <Field label="ตำแหน่ง *">
              <select value={form.position} onChange={e => set('position', e.target.value)}>
                <option>คนขับ</option>
                <option>ช่าง</option>
                <option>ผู้จัดการขนส่ง</option>
                <option>ผู้ดูแลระบบ</option>
                <option>เจ้าหน้าที่บัญชี</option>
              </select>
            </Field>
          </div>
          <Field label="สถานะ *">
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              style={{ maxWidth: 320 }}
            >
              <option value="active">ทำงาน</option>
              <option value="leave">ลาออก</option>
              <option value="training">อบรม</option>
            </select>
          </Field>
        </div>

        {/* Contact info */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="phone" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลการติดต่อ</h3>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="เบอร์โทรศัพท์ *">
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="เช่น 0812345678"
              />
            </Field>
            <Field label="Line ID (ไม่บังคับ)">
              <input
                value={form.lineId}
                onChange={e => set('lineId', e.target.value)}
                placeholder="เช่น @somchai"
              />
            </Field>
          </div>
        </div>

        {/* Documents and start date */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="check" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>เอกสารและวันเริ่มงาน</h3>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันเริ่มงาน *">
              <input
                type="date"
                value={form.joined}
                onChange={e => set('joined', e.target.value)}
              />
            </Field>
            <Field label="สถานะใบขับขี่">
              <select
                value={form.licenseStatus}
                onChange={e => set('licenseStatus', e.target.value)}
              >
                <option value="ok">ถูกต้อง (ยังไม่หมดอายุ)</option>
                <option value="warning">ใกล้หมดอายุ</option>
                <option value="expired">หมดอายุแล้ว</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={() => setActive('employees')}>
          <Icon name="close" size={15} /> ยกเลิก
        </button>
        <button className="btn primary" onClick={save}>
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  )
}
