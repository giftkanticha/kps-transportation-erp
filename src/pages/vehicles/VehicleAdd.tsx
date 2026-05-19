import { useState } from 'react'
import { useList, useInsert } from '../../hooks/useTable'
import type { Employee, Vehicle } from '../../types'
import { Icon, Field } from '../../components/ui'

interface VehicleAddProps {
  setActive: (id: string) => void
}

type VehicleGroup = 'INTERNAL' | 'TRANSPORT'

interface VehicleForm {
  plate: string
  brand: string
  year: string
  type: string
  customType: string
  group: VehicleGroup
  status: string
  driverId: string
  odometer: number
  nextServiceKm: string
  purchaseDate: string
  tax: string
  insurance: string
  dispatchPermit: string
}

export function VehicleAdd({ setActive }: VehicleAddProps) {
  const { data: employees = [] } = useList<Employee>('employees')
  const insertVehicle = useInsert<Vehicle>('vehicles')
  const [form, setForm] = useState<VehicleForm>({
    plate: '',
    brand: '',
    year: '',
    type: '10ล้อ',
    customType: '',
    group: 'TRANSPORT',
    status: 'available',
    driverId: '',
    odometer: 0,
    nextServiceKm: '',
    purchaseDate: '',
    tax: '',
    insurance: '',
    dispatchPermit: '',
  })

  const set = (k: keyof VehicleForm, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.plate || !form.brand) {
      alert('กรุณากรอกทะเบียนและยี่ห้อ')
      return
    }
    await insertVehicle.mutateAsync({
      ...form,
      type: form.type === 'อื่นๆ' ? (form.customType.trim() || 'อื่นๆ') : form.type,
      group: form.group,
      status: form.status as Vehicle['status'],
      odometer: +form.odometer || 0,
      nextServiceKm: +form.nextServiceKm || 0,
      year: +form.year || new Date().getFullYear(),
      driverId: form.driverId || null,
      fuel: 100,
      lastService: '',
      nextService: '',
    })
    setActive('vehicles')
  }

  const availableDrivers = employees.filter(
    e => e.position === 'คนขับ' && !e.vehicleId,
  )

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
            onClick={() => setActive('vehicles')}
          >
            <Icon name="arrow-right" size={15} style={{ transform: 'rotate(180deg)' }} />
            <span>รายการรถ</span>
          </div>
          <h1 className="page-title">เพิ่มรถใหม่</h1>
          <div className="page-sub">บันทึกข้อมูลรถคันใหม่เข้าระบบ</div>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        {/* General info */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="truck" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลทั่วไป</h3>
          </div>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ทะเบียนรถ *">
              <input
                value={form.plate}
                onChange={e => set('plate', e.target.value)}
                placeholder="เช่น ABC-1234"
              />
            </Field>
            <Field label="ยี่ห้อ *">
              <input
                value={form.brand}
                onChange={e => set('brand', e.target.value)}
                placeholder="เช่น Isuzu, Hino"
              />
            </Field>
            <Field label="รุ่น / ปี">
              <input
                value={form.year}
                onChange={e => set('year', e.target.value)}
                placeholder="เช่น FVR 2018"
              />
            </Field>
          </div>
          <div className="grid-3" style={{ gap: 14 }}>
            <Field label="ประเภทรถ *">
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option>4ล้อ</option>
                <option>6ล้อ</option>
                <option>10ล้อ</option>
                <option>18ล้อ</option>
                <option>22ล้อ</option>
                <option>ตู้คอนเทนเนอร์</option>
                <option>พ่วงข้าง</option>
                <option value="อื่นๆ">อื่นๆ (กำหนดเอง)</option>
              </select>
            </Field>
            {form.type === 'อื่นๆ' && (
              <Field label="ระบุประเภทรถ *">
                <input
                  value={form.customType}
                  onChange={e => set('customType', e.target.value)}
                  placeholder="เช่น รถพ่วง 18ล้อ, รถบรรทุก 6 ล้อเล็ก"
                />
              </Field>
            )}
            <Field label="สถานะเริ่มต้น">
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="available">พร้อมใช้งาน</option>
                <option value="maintenance">ซ่อมบำรุง</option>
                <option value="warning">เตือน</option>
              </select>
            </Field>
            <Field label="คนขับประจำรถ">
              <select value={form.driverId} onChange={e => set('driverId', e.target.value)}>
                <option value="">-- ยังไม่ระบุ --</option>
                {availableDrivers.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.code})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Group */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 12 }}>
            <span>⛽</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>กลุ่มรถ (ควบคุมการจ่ายน้ำมัน)</h3>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['INTERNAL', 'TRANSPORT'] as VehicleGroup[]).map(g => {
              const active = form.group === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => set('group', g)}
                  style={{
                    flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600,
                    fontFamily: 'inherit', cursor: 'pointer', transition: 'all .12s',
                    border: `2px solid ${active ? '#0066CC' : 'var(--line)'}`,
                    borderRadius: 8,
                    background: active ? '#EFF6FF' : 'var(--card)',
                    color: active ? '#1D4ED8' : 'var(--text-2)',
                  }}
                >
                  {g === 'INTERNAL' ? '🏭 โรงงาน (INTERNAL)' : '🚛 ขนส่ง (TRANSPORT)'}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {form.group === 'INTERNAL'
              ? 'น้ำมันถูกตัดสต็อคทันที — ไม่ต้องผูกรอบงาน'
              : 'น้ำมันต้องผูกกับรอบงาน — ถ้าไม่พบรอบจะบันทึกเป็น "น้ำมันลอย"'}
          </div>
        </div>

        {/* Odometer / fuel */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="gauge" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลระยะทาง</h3>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="เลขไมล์ปัจจุบัน (km) *">
              <input
                type="number"
                value={form.odometer}
                onChange={e => set('odometer', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="ระยะทางเข้าศูนย์บริการถัดไป (km)">
              <input
                type="number"
                value={form.nextServiceKm}
                onChange={e => set('nextServiceKm', e.target.value)}
                placeholder="เช่น 10000"
              />
            </Field>
          </div>
        </div>

        {/* Document dates */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>
              <Icon name="calendar" size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>วันหมดอายุ และ เอกสาร</h3>
          </div>
          <div className="grid-4" style={{ gap: 14 }}>
            <Field label="วันที่ซื้อรถ">
              <input
                type="date"
                value={form.purchaseDate}
                onChange={e => set('purchaseDate', e.target.value)}
              />
            </Field>
            <Field label="วันหมดอายุภาษี">
              <input
                type="date"
                value={form.tax}
                onChange={e => set('tax', e.target.value)}
              />
            </Field>
            <Field label="วันหมดอายุประกันภัย">
              <input
                type="date"
                value={form.insurance}
                onChange={e => set('insurance', e.target.value)}
              />
            </Field>
            <Field label="วันหมดอายุพรบ.">
              <input
                type="date"
                value={form.dispatchPermit}
                onChange={e => set('dispatchPermit', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={() => setActive('vehicles')}>
          <Icon name="close" size={15} /> ยกเลิก
        </button>
        <button className="btn primary" onClick={save}>
          บันทึกข้อมูลรถ
        </button>
      </div>
    </div>
  )
}
