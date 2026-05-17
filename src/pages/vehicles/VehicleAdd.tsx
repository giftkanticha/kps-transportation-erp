import { useState } from 'react'
import { db } from '../../lib/db'
import type { Employee, Vehicle } from '../../types'
import { Icon, Field } from '../../components/ui'

interface VehicleAddProps {
  setActive: (id: string) => void
}

interface VehicleForm {
  plate: string
  brand: string
  year: string
  type: string
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
  const employees = db.getAll<Employee>('employees')
  const [form, setForm] = useState<VehicleForm>({
    plate: '',
    brand: '',
    year: '',
    type: '10ล้อ',
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

  const save = () => {
    if (!form.plate || !form.brand) {
      alert('กรุณากรอกทะเบียนและยี่ห้อ')
      return
    }
    db.add<Partial<Vehicle>>('vehicles', {
      ...form,
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
              </select>
            </Field>
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
            <Field label="วันหมดอายุใบอนุญาตขนส่ง">
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
