import { useState } from 'react'
import type { SubDriver, SubJob, User, Subcontractor, Vehicle } from '../../types'
import { db } from '../../lib/db'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { Icon, Field, Info, PrintButton } from '../../components/ui'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubcontractorModuleProps {
  tab: string
  setActive: (id: string) => void
  user?: User
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: 'เปิดงาน', cls: 'blue' },
  unpaid: { label: 'รอชำระเงิน', cls: 'amber' },
  paid: { label: 'ชำระแล้ว', cls: 'green' },
}


// ─── Confirm Dialog (shared) ─────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, message, confirmLabel, destructive, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', borderRadius: 12, width: '90%', maxWidth: 440, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,.25)' }}
      >
        <h2 style={{ margin: '0 0 10px 0', fontSize: 17, fontWeight: 700 }}>{title}</h2>
        <p style={{ margin: '0 0 22px 0', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.55 }}>{message}</p>
        <div className="row btn-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>
            <Icon name="close" size={15} /> ยกเลิก
          </button>
          <button
            className={`btn ${destructive ? 'danger solid' : 'primary'}`}
            onClick={onConfirm}
          >
            <Icon name={destructive ? 'close' : 'check'} size={15} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Driver Modal ───────────────────────────────────────────────────────

interface DriverEditModalProps {
  driver: SubDriver | null
  onClose: () => void
  onSaved: () => void
}

function DriverEditModal({ driver, onClose, onSaved }: DriverEditModalProps) {
  const isNew = !driver
  const { data: subs = [] } = useList<Subcontractor>('subcontractors')
  const { data: allDrivers = [] } = useList<SubDriver>('sub_drivers')
  const insertDriver = useInsert<SubDriver>('sub_drivers')
  const updateDriver = useUpdate<SubDriver>('sub_drivers')
  const nextCode = isNew
    ? 'D' + String(
        allDrivers.reduce((max, d) => {
          const n = parseInt(d.code.replace(/\D/g, ''), 10)
          return isNaN(n) ? max : Math.max(max, n)
        }, 0) + 1,
      ).padStart(3, '0')
    : driver!.code

  const [form, setForm] = useState({
    code: nextCode,
    name: driver?.name ?? '',
    plate: driver?.plate ?? '',
    phone: driver?.phone ?? '',
    idCard: driver?.idCard ?? '',
    license: driver?.license ?? '',
    licenseExpire: driver?.licenseExpire ?? '',
    licenseStatus: driver?.licenseStatus ?? 'ok',
    accountBank: driver?.accountBank ?? 'KBANK',
    accountNo: driver?.accountNo ?? '',
    status: driver?.status ?? 'active',
    subId: driver?.subId ?? (subs[0]?.id ?? ''),
    address: driver?.address ?? '',
    truckDump: driver?.truckDump ?? 'no-dump' as 'dump' | 'no-dump',
    cpAccess: driver?.cpAccess ?? 'no' as 'yes' | 'no',
  })

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim() || !form.plate.trim() || !form.phone.trim()) {
      alert('กรุณากรอก ชื่อ, ทะเบียนรถ และเบอร์โทร')
      return
    }
    const payload = { ...form, vehicleTypes: driver?.vehicleTypes ?? [] }
    if (isNew) {
      await insertDriver.mutateAsync(payload)
    } else {
      await updateDriver.mutateAsync({ id: driver!.id, patch: payload })
    }
    onSaved()
    onClose()
  }

  const radioRow: React.CSSProperties = {
    height: 38, display: 'flex', alignItems: 'center', gap: 22,
    padding: '0 12px', border: '1px solid var(--line)',
    borderRadius: 'var(--r-md)', background: '#fff',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="card" style={{ width: 640, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {isNew ? 'เพิ่มคนขับรถร่วม' : 'แก้ไขข้อมูลคนขับ'}
          </h3>
          <button className="btn ghost icon sm" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
            <Field label="รหัสคนขับ">
              <input value={form.code} readOnly style={{ background: 'var(--bg-2)', color: 'var(--text-muted)' }} />
            </Field>
            <Field label="ชื่อ-นามสกุล *">
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="เช่น สมชาย ใจดี" />
            </Field>
            <Field label="ทะเบียนรถ *">
              <input value={form.plate} onChange={e => set('plate', e.target.value)} placeholder="เช่น ABC-1234" />
            </Field>
            <Field label="เบอร์โทรศัพท์ *">
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="เช่น 081-234-5678" />
            </Field>
            <Field label="เลขบัตรประชาชน">
              <input value={form.idCard} onChange={e => set('idCard', e.target.value)} placeholder="1-1020-30405-12-3" />
            </Field>
            <Field label="ใบขับขี่">
              <input value={form.license} onChange={e => set('license', e.target.value)} placeholder="เลขที่: 1234567" />
            </Field>
            <Field label="ใบขับขี่หมดอายุ">
              <input type="date" value={form.licenseExpire} onChange={e => set('licenseExpire', e.target.value)} />
            </Field>
            <Field label="สถานะใบขับขี่">
              <select value={form.licenseStatus} onChange={e => set('licenseStatus', e.target.value)}>
                <option value="ok">ถูกต้อง</option>
                <option value="warning">ใกล้หมดอายุ</option>
                <option value="expired">หมดอายุแล้ว</option>
              </select>
            </Field>
            <Field label="ธนาคาร">
              <select value={form.accountBank} onChange={e => set('accountBank', e.target.value)}>
                <option>KBANK</option>
                <option>SCB</option>
                <option>BBL</option>
                <option>KTB</option>
                <option>BAY</option>
                <option>TMB</option>
                <option>GSB</option>
              </select>
            </Field>
            <Field label="เลขที่บัญชี">
              <input value={form.accountNo} onChange={e => set('accountNo', e.target.value)} placeholder="123-4-56789-0" />
            </Field>
            <Field label="ผู้รับเหมา (Subcontractor)">
              <select value={form.subId} onChange={e => set('subId', e.target.value)}>
                <option value="">-- ไม่ระบุ --</option>
                {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="สถานะ">
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ระงับ</option>
              </select>
            </Field>
            <Field label="รถบรรทุกพ่วง">
              <div style={radioRow}>
                {([['dump', 'ดั้ม'], ['no-dump', 'ไม่ดั้ม']] as const).map(([val, label]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13.5 }}>
                    <input
                      type="radio"
                      name="dv-dump"
                      checked={form.truckDump === val}
                      onChange={() => set('truckDump', val)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="เข้า CP">
              <div style={radioRow}>
                {([['yes', 'ได้'], ['no', 'ไม่ได้']] as const).map(([val, label]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13.5 }}>
                    <input
                      type="radio"
                      name="dv-cp"
                      checked={form.cpAccess === val}
                      onChange={() => set('cpAccess', val)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Field label="ที่อยู่">
              <textarea
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="เช่น 123/4 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ 10110"
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </Field>
          </div>
        </div>
        <div className="row btn-row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>
            <Icon name="close" size={15} /> ยกเลิก
          </button>
          <button className="btn primary" onClick={save}>
            <Icon name="check" size={15} /> {isNew ? 'บันทึก' : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 1: เปิดงาน ──────────────────────────────────────────────────────────

function SubOpenForm() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: allSubDrivers = [] } = useList<SubDriver>('sub_drivers')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const insertJob = useInsert<SubJob>('sub_jobs')
  const subDrivers = allSubDrivers.filter(d => d.status === 'active')

  const blank = {
    date: today,
    driverId: '',
    category: '',
    destination: '',
    weight: '',
    mode: 'per_ton' as 'per_ton' | 'lump' | 'per_kg',
    price: '',
  }

  const [form, setForm] = useState(blank)
  const [categoryAutoFilled, setCategoryAutoFilled] = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleDriverChange = (driverId: string) => {
    const driver = subDrivers.find(d => d.id === driverId)
    if (driver) {
      const vehicle = vehicles.find(v => v.plate.toLowerCase() === driver.plate.toLowerCase())
      if (vehicle?.type) {
        setForm(f => ({ ...f, driverId, category: vehicle.type }))
        setCategoryAutoFilled(true)
        return
      }
      if (driver.vehicleTypes && driver.vehicleTypes.length > 0) {
        setForm(f => ({ ...f, driverId, category: driver.vehicleTypes![0] }))
        setCategoryAutoFilled(true)
        return
      }
    }
    setCategoryAutoFilled(false)
    setForm(f => ({ ...f, driverId, category: f.category }))
  }

  const picked = subDrivers.find(d => d.id === form.driverId)
  const weightNum = parseFloat(form.weight) || 0
  const weightTons = weightNum / 1000
  const priceNum = parseFloat(form.price) || 0
  const total =
    form.mode === 'lump' ? priceNum :
    form.mode === 'per_kg' ? weightNum * priceNum :
    weightTons * priceNum

  const priceLabel =
    form.mode === 'per_ton' ? 'บาท / ตัน' :
    form.mode === 'per_kg' ? 'บาท / กก.' :
    'บาทเหมา'

  const save = async () => {
    if (!form.driverId) { alert('กรุณาเลือกทะเบียนรถรับจ้าง'); return }
    if (!form.destination.trim()) { alert('กรุณาระบุปลายทาง'); return }
    if (!form.price) { alert('กรุณากรอกค่าบรรทุก'); return }
    if (!picked) return
    await insertJob.mutateAsync({
      code: 'SUB-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 100)).padStart(2, '0'),
      date: form.date,
      subId: picked.subId,
      driverId: picked.id,
      plate: picked.plate,
      driverName: picked.name,
      category: form.category,
      destination: form.destination.trim(),
      origin: 'กรุงเทพ',
      weight: weightNum,
      finalWeight: 0,
      mode: form.mode,
      price: priceNum,
      total,
      status: 'open',
      bank: `${picked.accountBank} ${picked.accountNo}`,
    })
    alert('เปิดงานเรียบร้อย')
    setForm(blank)
    setCategoryAutoFilled(false)
  }

  const cancel = () => {
    setForm(blank)
    setCategoryAutoFilled(false)
  }

  return (
    <div className="card pad">
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 18 }}>เปิดงานรถรับจ้าง</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left */}
        <div className="col" style={{ gap: 14 }}>
          <Field label="วันที่ *">
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="ทะเบียนรถรับจ้าง *">
            <select value={form.driverId} onChange={e => handleDriverChange(e.target.value)}>
              <option value="">-- เลือกทะเบียนรถ (จากคนขับรถร่วม) --</option>
              {subDrivers.map(d => (
                <option key={d.id} value={d.id}>{d.plate} — {d.name}</option>
              ))}
            </select>
            {subDrivers.length === 0 && (
              <div className="faint" style={{ fontSize: 11, marginTop: 4, color: 'var(--amber)' }}>
                * ยังไม่มีคนขับรถร่วม กรุณาเพิ่มในเมนู "คนขับรถร่วม" ก่อน
              </div>
            )}
            {picked && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-sunk)', borderRadius: 6, fontSize: 12.5 }}>
                <div><span className="muted">คนขับ:</span> <strong>{picked.name}</strong></div>
                <div className="muted mono" style={{ fontSize: 11.5 }}>โทร: {picked.phone}</div>
              </div>
            )}
          </Field>
          <Field label="ประเภทรถ">
            <div style={{ position: 'relative' }}>
              <select
                value={form.category}
                onChange={e => { set('category', e.target.value); setCategoryAutoFilled(false) }}
              >
                <option value="">-- เลือกประเภทรถ --</option>
                <option>4ล้อ</option>
                <option>6ล้อ</option>
                <option>10ล้อ</option>
                <option>18ล้อ</option>
                <option>22ล้อ</option>
                <option>ตู้คอนเทนเนอร์</option>
                <option>พ่วงข้าง</option>
              </select>
            </div>
            {categoryAutoFilled && form.category && (
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="check" size={11} /> Auto-fill จาก Master Data: <strong>{form.category}</strong>
              </div>
            )}
          </Field>
          <Field label="สถานที่ปลายทาง *">
            <input value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="เช่น Chiang Mai, Rayong" />
          </Field>
        </div>

        {/* Right */}
        <div className="col" style={{ gap: 14 }}>
          <Field label="น้ำหนักต้นทาง (กก.)">
            <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="เช่น 15000" />
          </Field>
          <Field label="ประเภทการคำนวณ *">
            <div className="row" style={{ gap: 18, paddingTop: 4 }}>
              {([
                ['per_ton', 'ต่อตัน'],
                ['lump', 'เหมา'],
                ['per_kg', 'ต่อกิโลกรัม'],
              ] as const).map(([k, l]) => (
                <label key={k} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                  <input
                    type="radio"
                    name="sc-mode"
                    checked={form.mode === k}
                    onChange={() => set('mode', k)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label={`ค่าบรรทุก (${priceLabel}) *`}>
            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="เช่น 2500" />
          </Field>

          <div style={{ padding: '14px 16px', background: 'var(--primary-50)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="chart" size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>คาดการณ์:</span>
            <div className="spacer" />
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
              {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
            </span>
          </div>
          {form.mode === 'per_ton' && form.weight && form.price && (
            <div className="faint" style={{ fontSize: 11 }}>
              คำนวณจาก: {weightTons.toFixed(2)} ตัน × {form.price} บาท/ตัน
            </div>
          )}
          {form.mode === 'per_kg' && form.weight && form.price && (
            <div className="faint" style={{ fontSize: 11 }}>
              คำนวณจาก: {weightNum.toLocaleString()} กก. × {form.price} บาท/กก.
            </div>
          )}
          {form.mode === 'lump' && (
            <div className="faint" style={{ fontSize: 11 }}>
              เหมาจ่ายตามค่าบรรทุก ไม่อิงน้ำหนัก
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end', gap: 8, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <button className="btn" onClick={cancel}><Icon name="close" size={15} /> ยกเลิก</button>
        <button className="btn primary" onClick={save}><Icon name="check" size={15} /> เปิดงาน</button>
      </div>
    </div>
  )
}

// ─── Tab 2: ปิดงาน ───────────────────────────────────────────────────────────

function SubCloseForm() {
  const { data: allJobs = [] } = useList<SubJob>('sub_jobs')
  const { data: subDrivers = [] } = useList<SubDriver>('sub_drivers')
  const updateJob = useUpdate<SubJob>('sub_jobs')
  const openJobs = allJobs.filter(j => j.status === 'open')

  const [pickedId, setPickedId] = useState('')
  const [finalWeight, setFinalWeight] = useState('')

  const picked = openJobs.find(j => j.id === pickedId)
  const driver = picked ? subDrivers.find(d => d.id === picked.driverId) : null

  // Compute final total based on destination weight
  const fw = parseFloat(finalWeight) || 0
  const finalTons = fw / 1000
  const finalTotal = picked
    ? picked.mode === 'lump' ? picked.total
    : picked.mode === 'per_kg' ? fw * picked.price
    : finalTons * picked.price
    : 0

  const closeJob = async () => {
    if (!picked) return
    if ((picked.mode === 'per_ton' || picked.mode === 'per_kg') && !finalWeight) {
      alert('กรุณากรอกน้ำหนักปลายทาง')
      return
    }
    await updateJob.mutateAsync({
      id: picked.id,
      patch: {
        status: 'unpaid',
        finalWeight: fw,
        total: finalTotal,
      },
    })
    alert('ส่งข้อมูลเรียบร้อย — งานนี้รอชำระเงิน')
    setPickedId('')
    setFinalWeight('')
  }

  const cancel = () => {
    setPickedId('')
    setFinalWeight('')
  }

  return (
    <div className="card pad">
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 18 }}>ปิดงานรถรับจ้าง</h3>

      <Field label="เลือกงานรับจ้าง (เฉพาะงานที่ยังเปิดอยู่) *">
        <select value={pickedId} onChange={e => { setPickedId(e.target.value); setFinalWeight('') }}>
          <option value="">-- กรุณาเลือกงาน --</option>
          {openJobs.map(j => (
            <option key={j.id} value={j.id}>
              {j.code} • {j.plate} → {j.destination}
            </option>
          ))}
        </select>
      </Field>

      {!picked && openJobs.length === 0 && (
        <div className="empty" style={{ marginTop: 20 }}>ไม่มีงานเปิดอยู่ในขณะนี้</div>
      )}

      {picked && (
        <div style={{ marginTop: 18 }}>
          {/* Job details (read-only) */}
          <div style={{ padding: 18, background: 'var(--bg-sunk)', borderRadius: 10, marginBottom: 16 }}>
            <h3 className="section-title">ข้อมูลงาน</h3>
            <div className="grid-3" style={{ gap: 12 }}>
              <Info label="Job No" value={<span className="mono">{picked.code}</span>} />
              <Info label="วันที่" value={db.thaiDate(picked.date)} />
              <Info label="ทะเบียน" value={<span className="mono">{picked.plate}</span>} />
              <Info label="คนขับ" value={picked.driverName} />
              <Info label="ประเภทรถ" value={picked.category || '—'} />
              <Info label="ปลายทาง" value={picked.destination} />
              <Info label="น้ำหนักต้นทาง" value={picked.weight ? `${db.fmt(picked.weight)} กก.` : '—'} />
              <Info label="ประเภทคำนวณ" value={picked.mode === 'per_ton' ? 'ต่อตัน' : picked.mode === 'per_kg' ? 'ต่อกิโลกรัม' : 'เหมา'} />
              <Info label="ค่าบรรทุก" value={picked.mode === 'per_ton' ? `${db.fmt(picked.price)} บาท/ตัน` : picked.mode === 'per_kg' ? `${db.fmt(picked.price)} บาท/กก.` : db.thb(picked.price)} />
            </div>
          </div>

          {/* Final weight input + computed total */}
          {(picked.mode === 'per_ton' || picked.mode === 'per_kg') ? (
            <div className="card" style={{ padding: 18, marginBottom: 16, border: '2px solid var(--primary)' }}>
              <h3 className="section-title" style={{ color: 'var(--primary)' }}>คำนวณค่าขนส่ง</h3>
              <div className="grid-2" style={{ gap: 14 }}>
                <Field label="น้ำหนักปลายทาง (กก.) *">
                  <input
                    type="number"
                    value={finalWeight}
                    onChange={e => setFinalWeight(e.target.value)}
                    placeholder="กรอกน้ำหนัก ณ ปลายทาง"
                  />
                </Field>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>ค่าขนส่งที่ต้องชำระ</div>
                  <div style={{ padding: '12px 14px', background: 'var(--primary-50)', borderRadius: 8 }}>
                    <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                      {db.thb(finalTotal)}
                    </span>
                  </div>
                  <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
                    {picked.mode === 'per_kg'
                      ? `${fw.toLocaleString()} กก. × ${db.fmt(picked.price)} บาท/กก.`
                      : `${finalTons.toFixed(2)} ตัน × ${db.fmt(picked.price)} บาท/ตัน`}
                  </div>
                </div>
              </div>
              <div className="faint" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--amber)' }}>
                * คำนวณจากน้ำหนักปลายทาง ไม่ใช่ต้นทาง
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 18, marginBottom: 16, border: '2px solid var(--primary)' }}>
              <h3 className="section-title" style={{ color: 'var(--primary)' }}>ค่าขนส่งที่ต้องชำระ (เหมา)</h3>
              <div style={{ padding: '12px 14px', background: 'var(--primary-50)', borderRadius: 8 }}>
                <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                  {db.thb(picked.total)}
                </span>
              </div>
            </div>
          )}

          {/* Bank Info Card */}
          <div
            style={{
              padding: 18,
              border: '2px dashed var(--primary)',
              borderRadius: 10,
              marginBottom: 16,
              background: '#fefce8',
            }}
          >
            <div className="row" style={{ marginBottom: 12, gap: 8, alignItems: 'center' }}>
              <Icon name="money" size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>ข้อมูลธนาคารที่ต้องโอนเงิน</h3>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <Info label="ธนาคาร" value={driver?.accountBank || '—'} />
              <Info
                label="เลขบัญชี"
                value={<span className="mono" style={{ fontWeight: 700 }}>{driver?.accountNo || '—'}</span>}
              />
              <Info label="ชื่อบัญชี" value={driver?.name || picked.driverName || '—'} />
              <Info
                label="ยอดที่ต้องชำระ"
                value={
                  <span className="mono" style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)' }}>
                    {db.thb(picked.mode === 'lump' ? picked.total : finalTotal)}
                  </span>
                }
              />
            </div>
          </div>

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={cancel}>
              <Icon name="close" size={15} /> ยกเลิก
            </button>
            <button className="btn primary" onClick={closeJob}>
              <Icon name="check" size={15} /> ส่งข้อมูล รอชำระเงิน
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pay Modal ───────────────────────────────────────────────────────────────

function PayConfirmModal({ job, onClose, onPaid }: { job: SubJob; onClose: () => void; onPaid: () => void }) {
  const { data: subDrivers = [] } = useList<SubDriver>('sub_drivers')
  const updateJob = useUpdate<SubJob>('sub_jobs')
  const driver = subDrivers.find(d => d.id === job.driverId)

  const pay = async () => {
    await updateJob.mutateAsync({ id: job.id, patch: { status: 'paid' } })
    onPaid()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="card" style={{ width: 540, maxWidth: '95vw' }}>
        <div className="row" style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', gap: 12, whiteSpace: 'nowrap' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1, minWidth: 0 }}>ยืนยันการชำระเงิน</h3>
          <button className="btn ghost icon sm" onClick={onClose} style={{ flexShrink: 0 }}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: 22 }}>
          <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.55, wordBreak: 'break-word' }}>
            ตรวจสอบยอดก่อนปิดงาน — เมื่อยืนยันแล้วสถานะจะเปลี่ยนเป็น{' '}
            <strong style={{ color: 'var(--green)', whiteSpace: 'nowrap' }}>ชำระแล้ว</strong>
          </p>
          <div style={{ padding: 16, background: 'var(--bg-sunk)', borderRadius: 10 }}>
            <div className="grid-2" style={{ gap: 10 }}>
              <Info label="Job No" value={<span className="mono">{job.code}</span>} />
              <Info label="ทะเบียน" value={<span className="mono">{job.plate}</span>} />
              <Info label="คนขับ" value={job.driverName} />
              <Info label="ธนาคาร" value={driver?.accountBank || '—'} />
              <Info label="เลขบัญชี" value={<span className="mono">{driver?.accountNo || '—'}</span>} />
              <Info label="ชื่อบัญชี" value={driver?.name || '—'} />
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>ยอดที่จะชำระ</div>
              <span className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>
                {db.thb(job.total)}
              </span>
            </div>
          </div>
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={pay} style={{ whiteSpace: 'nowrap' }}>
            <Icon name="check" size={15} /> ยืนยันชำระเงิน
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Job Detail Drawer ───────────────────────────────────────────────────────

function JobDetailDrawer({ job, onClose }: { job: SubJob; onClose: () => void }) {
  const { data: subDrivers = [] } = useList<SubDriver>('sub_drivers')
  const driver = subDrivers.find(d => d.id === job.driverId)
  const modeLabel = job.mode === 'per_ton' ? 'ต่อตัน' : job.mode === 'per_kg' ? 'ต่อกิโลกรัม' : 'เหมา'
  const s = STATUS_LABEL[job.status]
  const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 700, maxWidth: '96vw', background: '#ffffff', borderRadius: 16, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="row" style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>รายละเอียดงานขนส่ง</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              <span className="mono" style={{ fontWeight: 600 }}>{job.code}</span>
              {' '}· {db.thaiDate(job.date)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${s?.cls ?? 'gray'}`}>{s?.label ?? job.status}</span>
            <button className="btn ghost icon sm" onClick={onClose}><Icon name="close" size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {/* Section 1: งานขนส่ง */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
            ข้อมูลงานขนส่ง
          </div>
          <div className="grid-2" style={{ gap: 14, marginBottom: 22 }}>
            <Info label="Job No" value={<span className="mono" style={{ fontWeight: 700 }}>{job.code}</span>} />
            <Info label="วันที่" value={db.thaiDate(job.date)} />
            <Info label="ทะเบียนรถ" value={<span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{job.plate}</span>} />
            <Info label="คนขับ" value={job.driverName} />
            <Info label="ต้นทาง" value={job.origin || 'กรุงเทพ'} />
            <Info label="ปลายทาง" value={job.destination} />
            <Info label="ประเภทรถ" value={job.category || '—'} />
            <Info label="สถานะ" value={<span className={`badge ${s?.cls ?? 'gray'}`}>{s?.label}</span>} />
          </div>

          {/* Section 2: น้ำหนักและราคา */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
            น้ำหนักและค่าขนส่ง
          </div>
          <div className="grid-2" style={{ gap: 14, marginBottom: 18 }}>
            <Info label="น้ำหนักต้นทาง" value={job.weight ? `${db.fmt(job.weight)} กก.` : '—'} />
            <Info label="น้ำหนักปลายทาง" value={job.finalWeight ? `${db.fmt(job.finalWeight)} กก.` : '—'} />
            <Info label="ประเภทการคำนวณ" value={modeLabel} />
            <Info label="ราคาค่าบรรทุก" value={
              <span className="mono">
                {fmt2(job.price)} ฿{job.mode === 'per_ton' ? '/ตัน' : job.mode === 'per_kg' ? '/กก.' : ' (เหมา)'}
              </span>
            } />
          </div>
          <div style={{
            padding: '16px 20px', background: 'var(--primary-50)',
            borderRadius: 10, marginBottom: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>ค่าขนส่งรวม</span>
            <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary)' }}>
              {fmt2(job.total)} <span style={{ fontSize: 14, fontWeight: 500 }}>฿</span>
            </span>
          </div>

          {/* Section 3: ธนาคาร */}
          {driver && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
                ข้อมูลธนาคาร (สำหรับโอนเงิน)
              </div>
              <div className="grid-2" style={{ gap: 14 }}>
                <Info label="ธนาคาร" value={driver.accountBank || '—'} />
                <Info label="เลขที่บัญชี" value={<span className="mono" style={{ fontWeight: 700 }}>{driver.accountNo || '—'}</span>} />
                <Info label="ชื่อบัญชี" value={driver.name || '—'} />
                <Info label="เบอร์โทร" value={driver.phone || '—'} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="row" style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn" onClick={onClose}><Icon name="close" size={14} /> ปิด</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: ประวัติการจ้าง ────────────────────────────────────────────────────

function SubHistoryTab() {
  const { data: all = [] } = useList<SubJob>('sub_jobs')
  const [plateF, setPlateF] = useState('all')
  const [monthF, setMonthF] = useState('')
  const [statusF, setStatusF] = useState('all')
  const [payJob, setPayJob] = useState<SubJob | null>(null)
  const [viewJob, setViewJob] = useState<SubJob | null>(null)

  const filtered = all.filter(j => {
    if (plateF !== 'all' && j.plate !== plateF) return false
    if (statusF !== 'all' && j.status !== statusF) return false
    if (monthF && !j.date.startsWith(monthF)) return false
    return true
  })

  const plates = [...new Set(all.map(j => j.plate))]

  const statusBadge = (status: string) => {
    const s = STATUS_LABEL[status]
    return <span className={`badge ${s?.cls ?? 'gray'}`}>{s?.label ?? status}</span>
  }

  return (
    <div className="card">
      {/* Print-only KPS header */}
      <div className="kps-print-header print-only">
        <p className="co">KPS Transportations</p>
        <p className="ttl">รายงานประวัติการจ้างรถรับจ้างร่วม</p>
        <p className="sub">{filtered.length} รายการ</p>
        <p className="ts">พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</p>
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="row sub-hist-actions">
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ประวัติการจ้างรถรับจ้าง</h3>
          <div className="spacer" />
          <PrintButton orientation="landscape" label="พิมพ์รายงาน" />
        </div>

        <div className="row sub-hist-filters" style={{ marginTop: 14, gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="ทะเบียนรถ">
            <select value={plateF} onChange={e => setPlateF(e.target.value)} style={{ width: 180 }}>
              <option value="all">ทั้งหมด</option>
              {plates.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="เดือน/ปี">
            <input type="month" value={monthF} onChange={e => setMonthF(e.target.value)} style={{ width: 200 }} />
          </Field>
          <Field label="สถานะ">
            <div className="row" style={{ gap: 4 }}>
              {([['all', 'ทั้งหมด'], ['open', 'เปิดงาน'], ['unpaid', 'รอชำระ'], ['paid', 'ชำระแล้ว']] as const).map(([k, l]) => (
                <button
                  key={k}
                  className={`chip ${statusF === k ? 'active' : ''}`}
                  style={{ height: 36 }}
                  onClick={() => setStatusF(k)}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Job No</th>
              <th>วันที่</th>
              <th>ทะเบียน</th>
              <th>ปลายทาง</th>
              <th className="right">น้ำหนัก (กก.)</th>
              <th className="right">ราคาค่าบรรทุก</th>
              <th className="right">ค่าขนส่งรวม</th>
              <th>สถานะ</th>
              <th className="sub-hist-action-col">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => {
              const modeShort = j.mode === 'per_ton' ? '/ตัน' : j.mode === 'per_kg' ? '/กก.' : ' เหมา'
              return (
                <tr key={j.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{j.code}</td>
                  <td className="num muted">{db.thaiDate(j.date)}</td>
                  <td><span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{j.plate}</span></td>
                  <td>{j.destination}</td>
                  <td className="num right">
                    {j.finalWeight ? db.fmt(j.finalWeight) : (j.weight ? db.fmt(j.weight) : '—')}
                  </td>
                  <td className="num right mono" style={{ fontSize: 12.5 }}>
                    {j.price
                      ? <>{j.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{modeShort}</span></>
                      : '—'}
                  </td>
                  <td className="num right mono" style={{ fontWeight: 600 }}>
                    {j.total
                      ? j.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '—'}
                  </td>
                  <td>{statusBadge(j.status)}</td>
                  <td className="sub-hist-action-col">
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        className="btn ghost icon sm"
                        title="ดูรายละเอียด"
                        onClick={() => setViewJob(j)}
                      >
                        <Icon name="dashboard" size={13} />
                      </button>
                      {j.status === 'unpaid' && (
                        <button className="btn sm primary" onClick={() => setPayJob(j)}>
                          <Icon name="money" size={13} /> ชำระเงิน
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty">ไม่พบข้อมูลการจ้าง</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewJob && (
        <JobDetailDrawer job={viewJob} onClose={() => setViewJob(null)} />
      )}
      {payJob && (
        <PayConfirmModal
          job={payJob}
          onClose={() => setPayJob(null)}
          onPaid={() => {}}
        />
      )}
    </div>
  )
}

// ─── Driver Action Menu ──────────────────────────────────────────────────────

interface DriverActionProps {
  driver: SubDriver
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onChanged: () => void
}

function DriverActionMenu({ driver, isAdmin, onEdit, onDelete, onChanged }: DriverActionProps) {
  const [open, setOpen] = useState(false)
  const updateDriver = useUpdate<SubDriver>('sub_drivers')

  const toggleStatus = async () => {
    await updateDriver.mutateAsync({
      id: driver.id,
      patch: { status: driver.status === 'active' ? 'inactive' : 'active' },
    })
    setOpen(false)
    onChanged()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn ghost icon sm" onClick={() => setOpen(o => !o)}>
        <Icon name="more" size={16} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 32, zIndex: 100,
            background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.1)', minWidth: 180, padding: 6,
          }}>
            {isAdmin ? (
              <>
                <button
                  className="btn ghost"
                  onClick={() => { setOpen(false); onEdit() }}
                  style={{ width: '100%', justifyContent: 'flex-start', gap: 8, padding: '8px 12px', minHeight: 36 }}
                >
                  <Icon name="edit" size={14} /> แก้ไข
                </button>
                <button
                  className="btn ghost"
                  onClick={toggleStatus}
                  style={{
                    width: '100%', justifyContent: 'flex-start', gap: 8, padding: '8px 12px', minHeight: 36,
                    color: driver.status === 'active' ? 'var(--amber)' : 'var(--green)',
                  }}
                >
                  <Icon name={driver.status === 'active' ? 'close' : 'check'} size={14} />
                  {driver.status === 'active' ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                </button>
                <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                <button
                  className="btn ghost"
                  onClick={() => { setOpen(false); onDelete() }}
                  style={{
                    width: '100%', justifyContent: 'flex-start', gap: 8, padding: '8px 12px', minHeight: 36,
                    color: '#A32D2D',
                  }}
                >
                  <Icon name="close" size={14} /> ลบ
                </button>
              </>
            ) : (
              <div className="muted" style={{ padding: '8px 12px', fontSize: 12 }}>
                เฉพาะแอดมินเท่านั้น
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab 4: คนขับรถร่วม ──────────────────────────────────────────────────────

function SubDriversList({ user }: { user?: User }) {
  const isAdmin = user?.role === 'admin'
  const { data: drivers = [] } = useList<SubDriver>('sub_drivers')
  const { data: allJobs = [] } = useList<SubJob>('sub_jobs')
  const deleteDriver = useDelete('sub_drivers')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<SubDriver | null>(null)
  const [addNew, setAddNew] = useState(false)
  const [deleting, setDeleting] = useState<SubDriver | null>(null)

  const filtered = drivers.filter(d => !q || d.name.toLowerCase().includes(q.toLowerCase()) || d.phone.includes(q) || d.plate.toLowerCase().includes(q.toLowerCase()))
  const today = new Date()

  const confirmDelete = async () => {
    if (!deleting) return
    const openJobs = allJobs.filter(j => j.driverId === deleting.id && j.status !== 'paid')
    if (openJobs.length > 0) {
      alert(`ไม่สามารถลบได้ — คนขับมีงานค้างอยู่ ${openJobs.length} งาน`)
      setDeleting(null)
      return
    }
    await deleteDriver.mutateAsync(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="card">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="row">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>คนขับรถร่วม</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              จัดการข้อมูลคนขับรถรับจ้างร่วม (Sub-contractors) {!isAdmin && '— เฉพาะแอดมินเท่านั้นที่แก้ไขได้'}
            </div>
          </div>
          <div className="spacer" />
          {isAdmin && (
            <button className="btn primary" onClick={() => setAddNew(true)}>
              <Icon name="plus" size={14} /> เพิ่มคนขับใหม่
            </button>
          )}
        </div>

        <div style={{ position: 'relative', marginTop: 14, maxWidth: 360 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์โทร / ทะเบียน..."
            style={{ width: '100%', height: 36, padding: '0 12px 0 34px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }}
          />
        </div>
      </div>

      <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส/ชื่อ-นามสกุล</th>
              <th>เบอร์โทร</th>
              <th>ทะเบียนรถ</th>
              <th>ดั้ม</th>
              <th>CP</th>
              <th>ใบขับขี่</th>
              <th>ธนาคาร</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const exp = new Date(d.licenseExpire)
              const days = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              const isExpired = d.licenseStatus === 'expired'
              const isNearExpiry = !isExpired && days <= 30

              return (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{d.name}</div>
                    <div className="muted mono" style={{ fontSize: 11.5 }}>{d.code}</div>
                  </td>
                  <td className="mono">{d.phone}</td>
                  <td>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">{d.plate}</span>
                  </td>
                  <td>
                    {d.truckDump === 'dump'
                      ? <span className="badge blue">ดั้ม</span>
                      : <span className="badge gray">ไม่ดั้ม</span>}
                  </td>
                  <td>
                    {d.cpAccess === 'yes'
                      ? <span className="badge green">ได้</span>
                      : <span className="badge amber">ไม่ได้</span>}
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{d.license || '—'}</div>
                    {d.licenseExpire && (
                      <div style={{ fontSize: 11, color: isExpired || isNearExpiry ? 'var(--red)' : 'var(--text-muted)' }}>
                        <Icon name="alert" size={11} style={{ verticalAlign: -2, marginRight: 2 }} />
                        {db.thaiDate(d.licenseExpire)}
                        {isExpired ? ' (หมดอายุ)' : isNearExpiry ? ` (${days} วัน)` : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{d.accountBank}</div>
                    <div className="muted mono" style={{ fontSize: 11.5 }}>{d.accountNo}</div>
                  </td>
                  <td>
                    {d.status === 'active' ? (
                      <span className="badge green">ใช้งาน</span>
                    ) : (
                      <span className="badge gray">ระงับ</span>
                    )}
                  </td>
                  <td>
                    <DriverActionMenu
                      driver={d}
                      isAdmin={isAdmin}
                      onEdit={() => setEditing(d)}
                      onDelete={() => setDeleting(d)}
                      onChanged={() => {}}
                    />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty">ไม่พบข้อมูลคนขับ</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <DriverEditModal
          driver={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {}}
        />
      )}
      {addNew && (
        <DriverEditModal
          driver={null}
          onClose={() => setAddNew(false)}
          onSaved={() => {}}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="⚠️ แน่ใจหรือ?"
          message={`ต้องการลบคนขับ "${deleting.name}" (${deleting.plate}) ออกจากระบบ? การกระทำนี้ไม่สามารถยกเลิกได้`}
          confirmLabel="ลบคนขับ"
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SubcontractorModule({ tab, setActive, user }: SubcontractorModuleProps) {
  const current = tab === 'close' ? 'close' : tab === 'history' ? 'history' : tab === 'drivers' ? 'drivers' : 'open'

  return (
    <div>
      <div className="page-head">
        <div><h1 className="page-title">รถรับจ้างร่วม (Subcontractors)</h1></div>
      </div>

      <div className="tabs" style={{ marginBottom: 22 }}>
        {([['open', 'open', 'เปิดงาน'], ['close', 'close', 'ปิดงาน'], ['history', 'history', 'ประวัติการจ้าง'], ['drivers', 'drivers', 'คนขับรถร่วม']] as const).map(([id, route, label]) => (
          <button
            key={id}
            className={`tab ${current === id ? 'active' : ''}`}
            onClick={() => setActive('subcontractors' + (route === 'open' ? '' : '.' + route))}
          >
            {label}
          </button>
        ))}
      </div>

      {current === 'open' && <SubOpenForm />}
      {current === 'close' && <SubCloseForm />}
      {current === 'history' && <SubHistoryTab />}
      {current === 'drivers' && <SubDriversList user={user} />}
    </div>
  )
}
