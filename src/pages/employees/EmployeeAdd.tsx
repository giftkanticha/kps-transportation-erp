import { useState } from 'react'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import type { Employee, Vehicle } from '../../types'
import { Icon, Field } from '../../components/ui'

interface EmployeeAddProps {
  setActive: (id: string) => void
}

interface EmployeeForm {
  code: string
  name: string
  position: string
  customPosition: string
  status: string
  phone: string
  lineId: string
  joined: string
  licenseStatus: string
}

export function EmployeeAdd({ setActive }: EmployeeAddProps) {
  const { data: employees = [] } = useList<Employee>('employees')
  const insertEmployee = useInsert<Employee>('employees')
  const updateVehicle = useUpdate<Vehicle>('vehicles')
  const maxNum = employees.reduce((max, e) => {
    const n = parseInt(e.code.replace(/\D/g, ''), 10)
    return isNaN(n) ? max : Math.max(max, n)
  }, 0)
  const autoCode = 'E' + String(maxNum + 1).padStart(3, '0')

  const [form, setForm] = useState<EmployeeForm>({
    code: autoCode,
    name: '',
    position: 'คนขับ',
    customPosition: '',
    status: 'active',
    phone: '',
    lineId: '',
    joined: '',
    licenseStatus: 'ok',
  })
  const [vehicleIds, setVehicleIds] = useState<string[]>([])
  const { data: allVehicles = [] } = useList<Vehicle>('vehicles')

  const set = (k: keyof EmployeeForm, v: string) =>
    setForm(f => ({ ...f, [k]: v }))
  const toggleVehicle = (id: string) =>
    setVehicleIds(ids => (ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]))

  const isDriver = form.position === 'คนขับ'

  const save = async () => {
    if (!form.name || !form.phone) {
      alert('กรุณากรอกชื่อและเบอร์โทร')
      return
    }
    if (insertEmployee.isPending) return
    try {
      const newEmp = await insertEmployee.mutateAsync({
        code: form.code,
        name: form.name,
        position: form.position === 'อื่นๆ' ? (form.customPosition.trim() || 'อื่นๆ') : form.position,
        status: form.status,
        phone: form.phone,
        lineId: form.lineId,
        joined: form.joined,
        licenseStatus: form.licenseStatus as Employee['licenseStatus'],
        license: '',
        licenseExpire: '',
        salary: 17000,
        vehicleId: isDriver ? (vehicleIds[0] ?? null) : null,
        idCard: '',
        accountBank: '',
        accountNo: '',
      })
      if (isDriver) {
        for (const vId of vehicleIds) {
          await updateVehicle.mutateAsync({ id: vId, patch: { driverId: newEmp.id } })
        }
      }
      setActive('employees')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    }
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
            <Field label="เลขที่ ID">
              <input
                value={form.code}
                readOnly
                style={{ background: 'var(--bg-2)', color: 'var(--text-muted)', cursor: 'default' }}
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
                <option value="อื่นๆ">อื่นๆ (กำหนดเอง)</option>
              </select>
            </Field>
            {form.position === 'อื่นๆ' && (
              <Field label="ระบุตำแหน่ง *">
                <input
                  value={form.customPosition}
                  onChange={e => set('customPosition', e.target.value)}
                  placeholder="เช่น เจ้าหน้าที่ฝ่ายขาย"
                />
              </Field>
            )}
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

        {/* Vehicles assigned (only for drivers) */}
        {isDriver && (
          <div className="card pad">
            <div className="row" style={{ marginBottom: 16, justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row">
                <span style={{ color: 'var(--primary)' }}>
                  <Icon name="truck" size={20} />
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ทะเบียนรถที่รับผิดชอบ</h3>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                เลือกแล้ว: <strong>{vehicleIds.length}</strong> คัน
              </span>
            </div>
            {allVehicles.length === 0 ? (
              <div
                style={{
                  padding: 14, border: '1px dashed var(--line)', borderRadius: 8,
                  fontSize: 13, color: 'var(--text-muted)', textAlign: 'center',
                }}
              >ยังไม่มีรถในระบบ — เพิ่มรถที่เมนู "รายการรถทั้งหมด"</div>
            ) : (
              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8,
                  padding: 10, border: '1px solid var(--line)', borderRadius: 8,
                  maxHeight: 220, overflowY: 'auto',
                }}
              >
                {allVehicles.map(v => {
                  const checked = vehicleIds.includes(v.id)
                  const otherDriver = !checked && v.driverId
                    ? (employees.find(e => e.id === v.driverId)?.name ?? '—')
                    : null
                  return (
                    <label
                      key={v.id}
                      className="row"
                      style={{
                        gap: 6, cursor: 'pointer', fontSize: 13,
                        padding: '6px 10px', borderRadius: 6,
                        border: '1px solid ' + (checked ? 'var(--primary)' : 'var(--line)'),
                        background: checked ? 'var(--primary-50, #EFF6FF)' : 'var(--card)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVehicle(v.id)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span className="mono" style={{ fontWeight: 600 }}>{v.plate}</span>
                      <span className="muted" style={{ fontSize: 11 }}>{v.type}</span>
                      {otherDriver && (
                        <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>
                          (ปัจจุบัน: {otherDriver})
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              เลือกได้หลายคัน · เชื่อมกับ "รายการรถทั้งหมด" · ระบบจะ auto-fill คนขับเมื่อเลือกรถดังกล่าวในเปิดงาน
            </div>
          </div>
        )}

        {/* Documents and start date */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="check" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>เอกสารและวันเริ่มงาน</h3>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันเริ่มงาน">
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
