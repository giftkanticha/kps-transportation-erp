import { useState } from 'react'
import type { SubDriver, SubJob } from '../../types'
import { db } from '../../lib/db'
import { Icon, Field, Info } from '../../components/ui'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubcontractorModuleProps {
  tab: string
  setActive: (id: string) => void
}

// ─── Tab 1: เปิดงาน ──────────────────────────────────────────────────────────

function SubOpenForm() {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today,
    plate: '',
    category: '10ล้อ',
    destination: '',
    weight: '',
    mode: 'per_ton' as 'per_ton' | 'per_kg' | 'lump',
    price: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const total =
    form.mode === 'lump'
      ? parseFloat(form.price) || 0
      : form.mode === 'per_kg'
        ? (parseFloat(form.weight) || 0) * (parseFloat(form.price) || 0)
        : (parseFloat(form.weight) || 0) * (parseFloat(form.price) || 0)

  const save = () => {
    if (!form.plate || !form.destination) { alert('กรุณาเลือกรถและระบุปลายทาง'); return }
    db.add<Partial<SubJob>>('subJobs', {
      code: 'SUB-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + Math.floor(Math.random() * 100),
      date: form.date,
      subId: '',
      plate: form.plate,
      driverName: '',
      destination: form.destination,
      origin: 'กรุงเทพ',
      weight: parseFloat(form.weight) || 0,
      mode: form.mode,
      price: parseFloat(form.price) || 0,
      total,
      status: 'open',
      bank: '',
    })
    alert('เปิดงานเรียบร้อย')
    setForm({ date: today, plate: '', category: '10ล้อ', destination: '', weight: '', mode: 'per_ton', price: '' })
  }

  const subDrivers = db.getAll<SubDriver>('subDrivers')

  return (
    <div className="card pad">
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 18 }}>เปิดงานรถรับจ้าง</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left */}
        <div className="col" style={{ gap: 14 }}>
          <Field label="วันที่ *">
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}/>
            <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>ระบบจะบันทึกเป็น ค.ศ. (CE) แต่อาจแสดงเป็น พ.ศ. ตามการตั้งค่าเครื่อง</div>
          </Field>
          <Field label="ทะเบียนรถรับจ้าง *">
            <select value={form.plate} onChange={e => set('plate', e.target.value)}>
              <option value="">-- เลือกทะเบียนรถ --</option>
              {subDrivers.map(d => <option key={d.id} value={d.plate}>{d.plate} ({d.name})</option>)}
              <option value="ABC-5678">ABC-5678</option>
              <option value="DEF-9012">DEF-9012</option>
              <option value="XYZ-9999">XYZ-9999</option>
            </select>
          </Field>
          <Field label="หมวดรถ">
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              <option>4ล้อ</option>
              <option>6ล้อ</option>
              <option>10ล้อ</option>
              <option>18ล้อ</option>
            </select>
          </Field>
          <Field label="สถานที่ปลายทาง *">
            <input value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="ระบุปลายทาง"/>
          </Field>
        </div>

        {/* Right */}
        <div className="col" style={{ gap: 14 }}>
          <Field label="น้ำหนักต้นทาง (กก.)">
            <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="เช่น 15000"/>
          </Field>
          <Field label="ประเภทการคำนวณ *">
            <div className="row" style={{ gap: 18, paddingTop: 4 }}>
              {([['per_ton', 'ต่อตัน'], ['per_kg', 'ต่อกิโลกรัม'], ['lump', 'เหมาจ่าย']] as const).map(([k, l]) => (
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
          <Field label={`ค่าบรรทุก (${form.mode === 'per_ton' ? 'บาท / ตัน' : form.mode === 'per_kg' ? 'บาท / กก.' : 'บาทเหมา'}) *`}>
            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="เช่น 300"/>
          </Field>

          <div style={{ padding: '12px 16px', background: 'var(--primary-50)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="chart" size={16} style={{ color: 'var(--primary)' }}/>
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>คาดการณ์ค่าบรรทุก:</span>
            <div className="spacer"/>
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
              {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
            </span>
          </div>
          <div className="faint" style={{ fontSize: 11 }}>
            * คำนวณเบื้องต้นจากน้ำหนักต้นทาง ({form.weight ? (parseFloat(form.weight) / 1000).toFixed(1) : '0'} ตัน × {form.price || 0} บาท)
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end', gap: 8, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <button className="btn"><Icon name="close" size={15}/> ยกเลิก</button>
        <button className="btn primary" onClick={save}><Icon name="check" size={15}/> เปิดงาน</button>
      </div>
    </div>
  )
}

// ─── Tab 2: ปิดงาน ───────────────────────────────────────────────────────────

function SubCloseForm() {
  const openJobs = db.getAll<SubJob>('subJobs').filter(j => j.status === 'open')
  const [pickedId, setPickedId] = useState('')
  const picked = openJobs.find(j => j.id === pickedId)

  const closeJob = () => {
    if (!picked) return
    db.update<SubJob>('subJobs', picked.id, { status: 'unpaid' })
    alert('ปิดงานเรียบร้อย')
    setPickedId('')
  }

  return (
    <div className="card pad">
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 18 }}>ปิดงานรถรับจ้าง</h3>
      <Field label="เลือกงานที่ต้องการปิด (เฉพาะสถานะเปิด) *">
        <select value={pickedId} onChange={e => setPickedId(e.target.value)}>
          <option value="">-- กรุณาเลือกงาน --</option>
          {openJobs.map(j => (
            <option key={j.id} value={j.id}>{j.code} • {j.plate} → {j.destination}</option>
          ))}
        </select>
      </Field>

      {picked && (
        <div style={{ marginTop: 18, padding: 18, background: 'var(--bg-sunk)', borderRadius: 10 }}>
          <h3 className="section-title">ข้อมูลงาน</h3>
          <div className="grid-3">
            <Info label="Job No" value={<span className="mono">{picked.code}</span>}/>
            <Info label="วันที่" value={db.thaiDate(picked.date)}/>
            <Info label="ทะเบียน" value={<span className="mono">{picked.plate}</span>}/>
            <Info label="ปลายทาง" value={picked.destination}/>
            <Info label="น้ำหนักต้นทาง" value={picked.weight ? `${picked.weight} กก.` : '—'}/>
            <Info label="ราคา" value={db.thb(picked.total)}/>
          </div>
          <div className="row" style={{ marginTop: 18, gap: 8 }}>
            <button className="btn" onClick={() => setPickedId('')}>ยกเลิก</button>
            <div className="spacer"/>
            <button className="btn primary" onClick={closeJob}>
              <Icon name="check" size={15}/> ปิดงาน
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: ประวัติการจ้าง ────────────────────────────────────────────────────

function SubHistoryTab() {
  const all = db.getAll<SubJob>('subJobs')
  const [plateF, setPlateF] = useState('all')
  const [monthF, setMonthF] = useState('')
  const [statusF, setStatusF] = useState('all')

  const filtered = all.filter(j => {
    if (plateF !== 'all' && j.plate !== plateF) return false
    if (statusF !== 'all' && j.status !== statusF) return false
    if (monthF && !j.date.startsWith(monthF)) return false
    return true
  })

  const plates = [...new Set(all.map(j => j.plate))]

  const statusBadge = (status: string) => {
    if (status === 'paid') return <span className="badge green">ชำระแล้ว</span>
    if (status === 'unpaid') return <span className="badge amber">ค้างชำระ</span>
    return <span className="badge blue">เปิดงาน</span>
  }

  return (
    <div className="card">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="row">
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ประวัติการจ้างรถรับจ้าง</h3>
          <div className="spacer"/>
          <button className="btn"><Icon name="download" size={14}/> ส่งออกข้อมูล</button>
        </div>

        <div className="row" style={{ marginTop: 14, gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="ทะเบียนรถ">
            <select value={plateF} onChange={e => setPlateF(e.target.value)} style={{ width: 180 }}>
              <option value="all">ทั้งหมด</option>
              {plates.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="เดือน/ปี (รูปแบบ YYYY-MM)">
            <input type="month" value={monthF} onChange={e => setMonthF(e.target.value)} style={{ width: 200 }}/>
          </Field>
          <Field label="สถานะ">
            <div className="row" style={{ gap: 4 }}>
              {([['all', 'ทั้งหมด'], ['open', 'เปิดงาน'], ['unpaid', 'ค้างชำระ'], ['paid', 'ชำระแล้ว']] as const).map(([k, l]) => (
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
              <th className="right">ค่าขนส่ง (บาท)</th>
              <th>สถานะ</th>
              <th>ธนาคาร</th>
              <th>ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => (
              <tr key={j.id}>
                <td className="mono" style={{ fontWeight: 600 }}>{j.code}</td>
                <td className="num muted">{db.thaiDate(j.date)}</td>
                <td><span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{j.plate}</span></td>
                <td>{j.destination}</td>
                <td className="num right">{j.weight || '—'}</td>
                <td className="num right" style={{ fontWeight: 600 }}>{j.total ? db.fmt(j.total) : '—'}</td>
                <td>{statusBadge(j.status)}</td>
                <td className="muted">{j.bank || '—'}</td>
                <td>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn ghost icon sm" title="ดู"><Icon name="dashboard" size={13}/></button>
                    <button className="btn ghost icon sm" title="ตรวจ"><Icon name="check" size={13}/></button>
                    <button className="btn ghost icon sm" title="แก้ไข"><Icon name="edit" size={13}/></button>
                    <button className="btn ghost icon sm danger" title="ลบ"><Icon name="trash" size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
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
    </div>
  )
}

// ─── Tab 4: คนขับรถร่วม ──────────────────────────────────────────────────────

function SubDriversList() {
  const drivers = db.getAll<SubDriver>('subDrivers')
  const [q, setQ] = useState('')
  const filtered = drivers.filter(d => !q || d.name.toLowerCase().includes(q.toLowerCase()) || d.phone.includes(q))

  const today = new Date()

  return (
    <div className="card">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="row">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>คนขับรถร่วม</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>จัดการข้อมูลคนขับรถรับจ้างร่วม (Sub-contractors)</div>
          </div>
          <div className="spacer"/>
          <button className="btn primary"><Icon name="plus" size={14}/> เพิ่มคนขับใหม่</button>
        </div>

        <div style={{ position: 'relative', marginTop: 14, maxWidth: 320 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}/>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ, เบอร์โทร..."
            style={{ width: '100%', height: 36, padding: '0 12px 0 34px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }}
          />
        </div>
      </div>

      <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส/ชื่อ-นามสกุล</th>
              <th>ทะเบียนรถ</th>
              <th>ข้อมูลติดต่อ</th>
              <th>เลขบัตรประชาชน</th>
              <th>ใบขับขี่</th>
              <th>ข้อมูลบัญชี (รับเงิน)</th>
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
                  <td>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">{d.plate}</span>
                  </td>
                  <td className="mono">{d.phone}</td>
                  <td className="mono">{d.idCard}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>{d.license}</div>
                    <div style={{ fontSize: 11, color: isExpired || isNearExpiry ? 'var(--red)' : 'var(--text-muted)' }}>
                      <Icon name="alert" size={11} style={{ verticalAlign: -2, marginRight: 2 }}/>
                      หมดอายุ: {db.thaiDate(d.licenseExpire)}
                      {isExpired ? ' (หมดอายุแล้ว)' : isNearExpiry ? ` (ใกล้หมดอายุ ${days} วัน)` : ''}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{d.accountBank}</div>
                    <div className="muted mono" style={{ fontSize: 11.5 }}>{d.accountNo}</div>
                  </td>
                  <td><span className="badge green">ใช้งาน</span></td>
                  <td>
                    <button className="btn ghost icon sm"><Icon name="more" size={16}/></button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty">ไม่พบข้อมูลคนขับ</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SubcontractorModule({ tab, setActive }: SubcontractorModuleProps) {
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

      {current === 'open'    && <SubOpenForm/>}
      {current === 'close'   && <SubCloseForm/>}
      {current === 'history' && <SubHistoryTab/>}
      {current === 'drivers' && <SubDriversList/>}
    </div>
  )
}
