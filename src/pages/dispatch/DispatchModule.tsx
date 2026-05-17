import React, { useState, useMemo, useEffect } from 'react'
import type { User, Dispatch, DispatchLeg } from '../../types'
import { db } from '../../lib/db'
import { Icon, Field, StatusBadge, Info } from '../../components/ui'
import { DispatchFuelReport } from './DispatchFuelReport'
import { DispatchMonthlyReport } from './DispatchMonthlyReport'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DispatchModuleProps {
  tab: string
  setActive: (id: string) => void
  user: User
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>
  </svg>
)
const CheckBoxIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 12 3 3 5-6"/>
  </svg>
)
const DocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <path d="M14 3v6h6"/><path d="M9 14h6M9 18h4"/>
  </svg>
)
const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>
  </svg>
)
const PrintIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>
  </svg>
)
const RouteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/>
    <path d="M8 19h7a4 4 0 0 0 0-8h-6a4 4 0 0 1 0-8h7"/>
  </svg>
)
const TruckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/>
    <circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17.5" cy="17.5" r="1.7"/>
  </svg>
)
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5"/>
  </svg>
)
const FuelBadgeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -2 }}>
    <rect x="4" y="3" width="10" height="18" rx="1"/>
    <path d="M14 7h2l2 2v8a2 2 0 0 1-4 0v-3"/><path d="M7 7h4"/>
  </svg>
)

// ─── Leg form type ────────────────────────────────────────────────────────────

interface LegForm {
  origin: string
  destination: string
  cargo: string
  cargoType: string
  priceMode: 'per_ton' | 'per_kg' | 'lump'
  weight: string
  price: string
}

function emptyLeg(): LegForm {
  return { origin: '', destination: '', cargo: '', cargoType: '', priceMode: 'per_ton', weight: '', price: '' }
}

function calcLegAmount(leg: LegForm): number {
  const w = parseFloat(leg.weight) || 0
  const p = parseFloat(leg.price) || 0
  if (leg.priceMode === 'per_kg') return w * 1000 * p
  if (leg.priceMode === 'per_ton') return w * p
  return p // lump
}

// ─── Tabs component ───────────────────────────────────────────────────────────

interface TabsProps {
  current: string
  onChange: (t: string) => void
}

function DispatchTabs({ current, onChange }: TabsProps) {
  const items = [
    { id: 'open',    label: 'เปิดงาน',              icon: <SendIcon /> },
    { id: 'close',   label: 'ปิดงาน',               icon: <CheckBoxIcon /> },
    { id: 'fuel',    label: 'รายงานประจำวัน',        icon: <FuelBadgeIcon /> },
    { id: 'monthly', label: 'รายงานประจำเดือน',      icon: <DocIcon /> },
    { id: 'report',  label: 'รายงานสรุป',            icon: <DocIcon /> },
    { id: 'history', label: 'ประวัติการวิ่งงาน',     icon: <HistoryIcon /> },
  ]
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 6, display: 'inline-flex', gap: 2 }}>
      {items.map(it => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 18px',
            border: 'none', borderRadius: 8,
            background: current === it.id ? 'var(--primary-50)' : 'transparent',
            color: current === it.id ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: current === it.id ? 600 : 500,
            fontSize: 13.5,
            cursor: 'pointer',
            borderBottom: current === it.id ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2,
            transition: 'background .15s, color .15s',
          }}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

// ─── LegCard ─────────────────────────────────────────────────────────────────

interface LegCardProps {
  idx: number
  leg: LegForm
  onChange: (patch: Partial<LegForm>) => void
  onRemove: (() => void) | null
  amount: number
}

function LegCard({ idx, leg, onChange, onRemove, amount }: LegCardProps) {
  const [open, setOpen] = useState(true)
  const filled = !!(leg.origin && leg.destination && leg.cargo)
  const set = (k: keyof LegForm, v: string) => onChange({ [k]: v })

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, marginBottom: 14, overflow: 'hidden', background: 'var(--bg-elev)' }}>
      {/* Header */}
      <div
        className="row"
        style={{ padding: '12px 16px', background: 'var(--bg-sunk)', cursor: 'pointer', gap: 10 }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          {idx + 1}
        </div>
        <div style={{ flex: 1, fontStyle: filled ? 'normal' : 'italic', color: filled ? 'var(--text-2)' : 'var(--text-muted)', fontWeight: filled ? 600 : 400, fontSize: 13.5 }}>
          {filled
            ? <>ขาที่ {idx + 1} — <span style={{ fontWeight: 500 }}>{leg.origin} → {leg.destination}</span></>
            : `ขาที่ ${idx + 1} — ยังไม่ได้กรอกข้อมูล`}
        </div>
        {filled && <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{db.thb(amount)}</span>}
        {onRemove && (
          <button
            className="btn ghost icon sm danger"
            onClick={e => { e.stopPropagation(); if (confirm('ลบขานี้?')) onRemove() }}
          >
            <Icon name="trash" size={14}/>
          </button>
        )}
        <span style={{ color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .15s' }}>
          <Icon name="chevron-down" size={16}/>
        </span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: 18 }}>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ต้นทาง *">
              <input value={leg.origin} onChange={e => set('origin', e.target.value)} placeholder="เช่น นครราชสีมา"/>
            </Field>
            <Field label="ปลายทาง *">
              <input value={leg.destination} onChange={e => set('destination', e.target.value)} placeholder="เช่น ขอนแก่น"/>
            </Field>
            <Field label="สินค้า *">
              <input value={leg.cargo} onChange={e => set('cargo', e.target.value)} placeholder="ระบุชื่อสินค้า"/>
            </Field>
            <Field label="ประเภทสินค้า">
              <select value={leg.cargoType} onChange={e => set('cargoType', e.target.value)}>
                <option value="">— เลือกประเภท —</option>
                <option>ทั่วไป</option>
                <option>แช่เย็น</option>
                <option>เคมี/IBC</option>
                <option>ตู้คอนเทนเนอร์</option>
                <option>วัสดุก่อสร้าง</option>
                <option>อันตราย</option>
              </select>
            </Field>
          </div>

          {/* Price mode radio */}
          <Field label="รูปแบบราคา">
            <div className="row" style={{ gap: 18, paddingTop: 4 }}>
              {([['per_ton', 'ต่อตัน'], ['per_kg', 'ต่อกิโลกรัม'], ['lump', 'เหมา']] as const).map(([k, l]) => (
                <label key={k} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                  <input
                    type="radio"
                    name={`pm-${idx}`}
                    checked={leg.priceMode === k}
                    onChange={() => set('priceMode', k)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  {l}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            {leg.priceMode !== 'lump' && (
              <Field label={leg.priceMode === 'per_kg' ? 'น้ำหนัก (กิโลกรัม)' : 'น้ำหนัก (ตัน)'}>
                <input type="number" value={leg.weight} onChange={e => set('weight', e.target.value)} placeholder="0.00"/>
              </Field>
            )}
            <Field
              label={`ราคา (${leg.priceMode === 'per_ton' ? 'บาท/ตัน' : leg.priceMode === 'per_kg' ? 'บาท/กก.' : 'บาทเหมา'}) *`}
              full={leg.priceMode === 'lump'}
            >
              <input type="number" value={leg.price} onChange={e => set('price', e.target.value)} placeholder="0.00"/>
            </Field>
          </div>

          {/* Auto-calc */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--primary-50)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--primary)' }}><Icon name="chart" size={16}/></span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)' }}>ค่าขนส่งขานี้:</span>
            <div className="spacer"/>
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
              {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 1: เปิดงาน ──────────────────────────────────────────────────────────

interface OpenFormProps {
  setActive: (id: string) => void
}

function DispatchOpenForm({ setActive }: OpenFormProps) {
  const today = new Date().toISOString().slice(0, 10)
  const newJobCode = useMemo(() => {
    const n = db.getAll<Dispatch>('dispatch').length + 1
    return 'DSP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(n).padStart(3, '0')
  }, [])

  const [form, setForm] = useState({
    code: newJobCode,
    date: today,
    customerId: '',
    vehicleId: '',
    driverId: '',
    startOdometer: '',
    notes: '',
    legs: [emptyLeg()],
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setLeg = (i: number, patch: Partial<LegForm>) =>
    setForm(f => ({ ...f, legs: f.legs.map((l, idx) => idx === i ? { ...l, ...patch } : l) }))
  const addLeg = () => setForm(f => ({ ...f, legs: [...f.legs, emptyLeg()] }))
  const removeLeg = (i: number) => setForm(f => ({ ...f, legs: f.legs.filter((_, idx) => idx !== i) }))

  const legAmounts = form.legs.map(calcLegAmount)
  const total = legAmounts.reduce((a, b) => a + b, 0)
  const dateLabel = db.thaiDate(form.date)

  const submit = (asDraft: boolean) => {
    if (!asDraft) {
      const hasEmpty = form.legs.some(l => !l.origin || !l.destination || !l.cargo)
      if (!form.vehicleId || !form.driverId) { alert('กรุณาเลือกรถและคนขับ'); return }
      if (hasEmpty) { alert('กรุณากรอกข้อมูลทุกขาให้ครบ'); return }
    }
    const legs: DispatchLeg[] = form.legs.map((l, i) => ({
      origin: l.origin,
      destination: l.destination,
      cargo: l.cargo,
      cargoType: l.cargoType,
      priceMode: l.priceMode,
      weight: parseFloat(l.weight) || 0,
      price: parseFloat(l.price) || 0,
      amount: legAmounts[i],
    }))
    db.add<Partial<Dispatch>>('dispatch', {
      code: form.code,
      date: form.date,
      vehicleId: form.vehicleId || null,
      driverId: form.driverId || null,
      subcontractorId: null,
      customerId: form.customerId,
      legs,
      startOdometer: parseFloat(form.startOdometer) || null,
      endOdometer: null,
      distance: null,
      liters: null,
      kmPerL: null,
      perDiem: null,
      notes: form.notes,
      status: asDraft ? 'scheduled' : 'in-progress',
      progress: asDraft ? 0 : 10,
      totalAmount: total,
      revenue: total,
      cost: 0,
      depart: form.date + ' ' + new Date().toTimeString().slice(0, 5),
      eta: form.date,
    })
    alert(asDraft ? 'บันทึกเป็นร่างเรียบร้อย' : `เปิดงาน ${form.code} เรียบร้อย`)
    setActive('dispatch.history')
  }

  const vehicles = db.getAll<{ id: string; plate: string; brand: string; type: string }>('vehicles')
  const employees = db.getAll<{ id: string; name: string; code: string; position: string; status: string }>('employees')
  const customers = db.getAll<{ id: string; name: string; code: string }>('customers')
  const drivers = employees.filter(e => e.position.includes('ขับ') && e.status === 'active')

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId)
  const selectedDriver = drivers.find(e => e.id === form.driverId)
  const selectedCustomer = customers.find(c => c.id === form.customerId)

  const handlePrint = () => window.print()

  return (
    <div>
      {/* Page head */}
      <div className="row no-print" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="page-title">เปิดงานขนส่ง</h1>
          <div className="page-sub">รองรับหลายขา (Multi-leg) ในรอบเดียว</div>
        </div>
        <div className="spacer"/>
        <span className="badge blue" style={{ padding: '5px 14px', fontSize: 12.5, marginRight: 8 }}>{dateLabel}</span>
        <button className="btn" onClick={handlePrint} title="พิมพ์ใบปล่อยรถ">
          <PrintIcon/> พิมพ์ใบปล่อยรถ
        </button>
      </div>

      {/* Card 1: รถและคนขับ */}
      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="head">
          <span style={{ color: 'var(--primary)' }}><TruckIcon/></span>
          <h3>ข้อมูลรถและคนขับ</h3>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="วันที่ *">
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}/>
            </Field>
            <Field label="ลูกค้า *">
              <select value={form.customerId} onChange={e => set('customerId', e.target.value)}>
                <option value="">— เลือกลูกค้า —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="รถ *">
              <select value={form.vehicleId} onChange={e => set('vehicleId', e.target.value)}>
                <option value="">— เลือกรถ —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} • {v.brand} ({v.type})</option>
                ))}
              </select>
            </Field>
            <Field label="คนขับ *">
              <select value={form.driverId} onChange={e => set('driverId', e.target.value)}>
                <option value="">— เลือกคนขับ —</option>
                {drivers.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                ))}
              </select>
            </Field>
            <Field label={<>เลขไมล์ต้นรอบ (km) <span style={{ verticalAlign: -2, color: 'var(--text-faint)' }}><InfoIcon/></span></> as unknown as string}>
              <input type="number" value={form.startOdometer} onChange={e => set('startOdometer', e.target.value)} placeholder="0"/>
            </Field>
          </div>
          <Field label="หมายเหตุรอบงาน">
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="ระบุหมายเหตุ (ถ้ามี)"/>
          </Field>
        </div>
      </div>

      {/* Card 2: เส้นทางและสินค้า */}
      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="head">
          <span style={{ color: 'var(--primary)' }}><RouteIcon/></span>
          <h3>เส้นทางและสินค้า</h3>
          <span className="badge blue mono">{form.legs.length} ขา</span>
        </div>
        <div style={{ padding: 22 }}>
          {form.legs.map((leg, i) => (
            <LegCard
              key={i}
              idx={i}
              leg={leg}
              onChange={p => setLeg(i, p)}
              onRemove={form.legs.length > 1 ? () => removeLeg(i) : null}
              amount={legAmounts[i]}
            />
          ))}
          <button
            className="btn outline"
            onClick={addLeg}
            style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: 4, borderStyle: 'dashed', fontWeight: 500 }}
          >
            <Icon name="plus" size={15}/> เพิ่มขาถัดไป
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="card pad no-print" style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <div>
          <div className="muted" style={{ fontSize: 12.5 }}>รวมค่าขนส่งทั้งรอบ ({form.legs.length} ขา)</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-.02em' }}>
            {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 500 }}>บาท</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="row no-print" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={() => setActive('dispatch.history')}>
          <Icon name="close" size={15}/> ยกเลิก
        </button>
        <button
          className="btn"
          style={{ background: 'var(--text-2)', color: '#fff', borderColor: 'var(--text-2)' }}
          onClick={() => submit(true)}
        >
          💾 บันทึกร่าง
        </button>
        <button className="btn primary" onClick={() => submit(false)}>
          <Icon name="check" size={15}/> เปิดงาน ({form.legs.length} ขา)
        </button>
      </div>

      {/* Print-only: ใบปล่อยรถ */}
      <div className="print-only">
        <div style={{ textAlign: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #000' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>ใบปล่อยรถ (Vehicle Release Slip)</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            เลขที่: <strong className="mono">{form.code}</strong> · วันที่: {dateLabel}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14, fontSize: 13 }}>
          <div>
            <div style={{ color: '#666', fontSize: 11 }}>ลูกค้า</div>
            <div style={{ fontWeight: 600 }}>{selectedCustomer?.name || '—'}</div>
          </div>
          <div>
            <div style={{ color: '#666', fontSize: 11 }}>เลขไมล์ต้นรอบ</div>
            <div className="mono" style={{ fontWeight: 600 }}>{form.startOdometer ? `${db.fmt(parseFloat(form.startOdometer))} km` : '—'}</div>
          </div>
          <div>
            <div style={{ color: '#666', fontSize: 11 }}>ทะเบียนรถ</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
              {selectedVehicle ? `${selectedVehicle.plate} (${selectedVehicle.brand} · ${selectedVehicle.type})` : '—'}
            </div>
          </div>
          <div>
            <div style={{ color: '#666', fontSize: 11 }}>คนขับ</div>
            <div style={{ fontWeight: 600 }}>{selectedDriver?.name || '—'} {selectedDriver?.code && `(${selectedDriver.code})`}</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 6px 0' }}>เส้นทางและสินค้า ({form.legs.length} ขา)</h3>
          <table className="tbl" style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>ขา</th>
                <th>ต้นทาง</th>
                <th>ปลายทาง</th>
                <th>สินค้า</th>
                <th>ประเภท</th>
                <th className="right">น้ำหนัก</th>
                <th className="right">ราคา</th>
                <th className="right">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {form.legs.map((l, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{l.origin || '—'}</td>
                  <td>{l.destination || '—'}</td>
                  <td>{l.cargo || '—'}</td>
                  <td>{l.cargoType || '—'}</td>
                  <td className="num right mono">{l.weight || '—'} {l.priceMode === 'per_kg' ? 'กก.' : l.priceMode === 'per_ton' ? 'ตัน' : ''}</td>
                  <td className="num right mono">{l.price || '—'}</td>
                  <td className="num right mono">{legAmounts[i].toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                <td colSpan={7} style={{ textAlign: 'right' }}>รวมค่าขนส่งทั้งรอบ:</td>
                <td className="num right mono">{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {form.notes && (
          <div style={{ marginBottom: 14, fontSize: 12 }}>
            <div style={{ color: '#666', fontSize: 11 }}>หมายเหตุ</div>
            <div>{form.notes}</div>
          </div>
        )}

        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 36, fontSize: 12 }}>ผู้ปล่อยรถ</div>
            <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 36, fontSize: 12 }}>คนขับ</div>
            <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CalcRow ──────────────────────────────────────────────────────────────────

interface CalcRowProps {
  label: string
  value: string
  ok?: boolean
  warn?: boolean
}

function CalcRow({ label, value, ok, warn }: CalcRowProps) {
  return (
    <div className="row" style={{
      padding: '10px 14px',
      background: warn ? 'var(--red-50)' : ok ? 'var(--green-50)' : 'var(--bg-sunk)',
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
      <div className="spacer"/>
      <span className="mono" style={{ fontWeight: 600, color: warn ? 'var(--red)' : ok ? '#166534' : 'var(--text-muted)' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Tab 2: ปิดงาน ───────────────────────────────────────────────────────────

function DispatchCloseForm() {
  const inProgress = db.getAll<Dispatch>('dispatch').filter(t => t.status === 'in-progress')
  const [pickedId, setPickedId] = useState('')
  const picked = db.get<Dispatch>('dispatch', pickedId)

  const [form, setForm] = useState({ endOdometer: '', endWeight: '', liters: '', perDiem: '' })
  useEffect(() => {
    if (picked) {
      setForm({
        endOdometer: picked.endOdometer != null ? String(picked.endOdometer) : '',
        endWeight: '',
        liters: picked.liters != null ? String(picked.liters) : '',
        perDiem: picked.perDiem != null ? String(picked.perDiem) : '',
      })
    }
  }, [pickedId])

  const start = picked?.startOdometer ?? 0
  const end = parseFloat(form.endOdometer) || 0
  const distance = end > start ? end - start : 0
  const liters = parseFloat(form.liters) || 0
  const kmPerL = liters > 0 ? distance / liters : 0
  const totalAmount = picked ? db.amountOf(picked) : 0
  const costPerKm = distance > 0 ? totalAmount / distance : 0

  const originWeight = picked ? db.legsOf(picked).reduce((s, l) => s + (l.weight || 0), 0) : 0
  const endWeight = parseFloat(form.endWeight) || 0
  const weightLoss = endWeight > 0 ? originWeight - endWeight : 0
  const weightLossPct = originWeight > 0 && endWeight > 0 ? (weightLoss / originWeight) * 100 : 0
  const weightLossExceeds = weightLossPct > 5

  const submit = () => {
    if (!picked) return
    if (!form.endOdometer) { alert('กรุณากรอกเลขไมล์ปลายทาง'); return }
    if (weightLossExceeds && !confirm(`⚠️ น้ำหนักสูญหายเกิน 5% (${weightLossPct.toFixed(1)}%)\nยืนยันปิดงานหรือไม่?`)) return
    db.update<Dispatch>('dispatch', picked.id, {
      endOdometer: parseFloat(form.endOdometer),
      liters: parseFloat(form.liters) || 0,
      perDiem: parseFloat(form.perDiem) || 0,
      distance,
      kmPerL,
      status: 'completed',
      progress: 100,
    })
    alert(`ปิดงาน ${picked.code} เรียบร้อย\nระยะทาง ${distance} km • ${kmPerL.toFixed(1)} km/l`)
    setPickedId('')
  }

  const handlePrint = () => window.print()

  return (
    <div>
      <div className="row no-print" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="page-title">ปิดงานขนส่ง</h1>
          <div className="page-sub">สรุปรอบงานทั้งหมดเมื่อกลับถึงที่หมาย</div>
        </div>
        <div className="spacer"/>
        {picked && (
          <button className="btn" onClick={handlePrint}>
            <PrintIcon/> พิมพ์สรุปงาน
          </button>
        )}
      </div>

      <div className="card pad no-print" style={{ marginBottom: 16 }}>
        <Field label="เลือกงานที่ต้องปิด">
          <select value={pickedId} onChange={e => setPickedId(e.target.value)}>
            <option value="">— เลือกงานที่กำลังดำเนินการ (In Progress) —</option>
            {inProgress.map(t => (
              <option key={t.id} value={t.id}>
                {t.code} • {db.thaiDate(t.date)} • {db.originOf(t)} → {db.destOf(t)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {picked && (
        <>
          {/* Job summary */}
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="head">
              <span style={{ color: 'var(--primary)' }}><TruckIcon/></span>
              <h3>ที่มา (ตอนเปิดงาน)</h3>
              <span className="mono badge gray">{picked.code}</span>
            </div>
            <div style={{ padding: 20 }}>
              <div className="grid-3" style={{ gap: 16, marginBottom: 14 }}>
                <Info label="วันที่" value={db.thaiDate(picked.date)}/>
                <Info label="รถ" value={<span className="mono">{db.nameOf('vehicles', picked.vehicleId ?? '')}</span>}/>
                <Info label="คนขับ" value={db.nameOf('employees', picked.driverId ?? '')}/>
              </div>
              <h3 className="section-title" style={{ marginTop: 6 }}>เส้นทาง ({picked.legs?.length || 1} ขา)</h3>
              <div className="col" style={{ gap: 8 }}>
                {db.legsOf(picked).map((leg, i) => (
                  <div key={i} className="row" style={{ padding: '10px 14px', background: 'var(--bg-sunk)', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div>{leg.origin} → {leg.destination}</div>
                    <div className="muted" style={{ fontSize: 12 }}>• {leg.cargo}</div>
                    <div className="spacer"/>
                    <div className="mono" style={{ fontWeight: 600 }}>{db.thb(leg.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <Info label="เลขไมล์ต้นทาง" value={<span className="mono">{db.fmt(picked.startOdometer)} km</span>}/>
                <div style={{ width: 32 }}/>
                <Info label="คาดการณ์ค่าขนส่ง" value={<span className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{db.thb(totalAmount)}</span>}/>
              </div>
            </div>
          </div>

          {/* Close form */}
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="head"><h3>ข้อมูลปิดงาน</h3></div>
            <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div className="col" style={{ gap: 14 }}>
                  <Field label="เลขไมล์ปลายทาง (km) *">
                    <input type="number" value={form.endOdometer} onChange={e => setForm(f => ({ ...f, endOdometer: e.target.value }))} placeholder={String(start)}/>
                  </Field>
                  <Field label={`น้ำหนักสินค้าปลายทาง (ตัน) · ต้นทาง ${db.fmt(originWeight)}`}>
                    <input type="number" value={form.endWeight} onChange={e => setForm(f => ({ ...f, endWeight: e.target.value }))} placeholder={String(originWeight)}/>
                  </Field>
                  <Field label="ลิตรน้ำมันที่เติม">
                    <input type="number" value={form.liters} onChange={e => setForm(f => ({ ...f, liters: e.target.value }))} placeholder="0.0"/>
                  </Field>
                  <Field label="ค่าเบี้ยเลี้ยง (บาท)">
                    <input type="number" value={form.perDiem} onChange={e => setForm(f => ({ ...f, perDiem: e.target.value }))}/>
                  </Field>
                </div>
              </div>
              <div>
                <h3 className="section-title">คำนวณอัตโนมัติ</h3>
                <div className="col" style={{ gap: 12 }}>
                  <CalcRow label="ระยะทาง" value={distance > 0 ? `${db.fmt(distance)} km` : '—'} ok={distance > 0}/>
                  <CalcRow
                    label="น้ำหนักสูญหาย"
                    value={endWeight > 0 ? `${db.fmt(weightLoss)} ตัน (${weightLossPct.toFixed(1)}%)` : '—'}
                    ok={endWeight > 0 && !weightLossExceeds}
                    warn={weightLossExceeds}
                  />
                  <CalcRow label="ค่าขนส่ง" value={db.thb(totalAmount)} ok/>
                  <CalcRow label="km/L" value={kmPerL > 0 ? `${kmPerL.toFixed(1)} km/l` : '—'} ok={kmPerL >= 2.5} warn={kmPerL > 0 && kmPerL < 2.5}/>
                  <CalcRow label="Cost/km" value={costPerKm > 0 ? `฿${costPerKm.toFixed(2)}/km` : '—'} ok={costPerKm > 0}/>
                </div>
              </div>
            </div>
          </div>

          {/* Weight loss warning */}
          {weightLossExceeds && (
            <div
              className="no-print"
              style={{
                marginBottom: 16,
                padding: '12px 16px',
                background: 'rgba(163,45,45,.08)',
                border: '1px solid #A32D2D',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#A32D2D',
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              <Icon name="alert" size={18}/>
              <div>
                <strong>คำเตือน:</strong> น้ำหนักสินค้าสูญหายเกิน 5% (
                <strong>{weightLossPct.toFixed(1)}%</strong>) — กรุณาตรวจสอบก่อนปิดงาน
              </div>
            </div>
          )}

          <div className="row no-print" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => setPickedId('')}><Icon name="close" size={15}/> ยกเลิก</button>
            <button className="btn primary" onClick={submit}><Icon name="check" size={15}/> ปิดงาน</button>
          </div>

          {/* Print-only summary */}
          <div className="print-only">
            <div style={{ textAlign: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #000' }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>สรุปงานขนส่ง (Job Summary)</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                เลขที่: <strong className="mono">{picked.code}</strong> · วันที่: {db.thaiDate(picked.date)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14, fontSize: 13 }}>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>ลูกค้า</div>
                <div style={{ fontWeight: 600 }}>{picked.customerId ? db.nameOf('customers', picked.customerId) : '—'}</div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>เลขไมล์</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {db.fmt(picked.startOdometer)} → {form.endOdometer ? db.fmt(parseFloat(form.endOdometer)) : '—'} km
                </div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>ทะเบียนรถ</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
                  {db.nameOf('vehicles', picked.vehicleId ?? '')}
                </div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>คนขับ</div>
                <div style={{ fontWeight: 600 }}>{db.nameOf('employees', picked.driverId ?? '')}</div>
              </div>
            </div>

            <table className="tbl" style={{ width: '100%', fontSize: 12, marginBottom: 14 }}>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>ขา</th>
                  <th>เส้นทาง</th>
                  <th>สินค้า</th>
                  <th className="right">น้ำหนัก</th>
                  <th className="right">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {db.legsOf(picked).map((leg, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{leg.origin} → {leg.destination}</td>
                    <td>{leg.cargo}</td>
                    <td className="num right mono">{leg.weight}</td>
                    <td className="num right mono">{leg.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                  <td colSpan={4} style={{ textAlign: 'right' }}>รวม:</td>
                  <td className="num right mono">{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14, fontSize: 12 }}>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>ระยะทาง</div>
                <div className="mono" style={{ fontWeight: 700 }}>{db.fmt(distance)} km</div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>ลิตรน้ำมัน</div>
                <div className="mono" style={{ fontWeight: 700 }}>{db.fmt(liters)} L</div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>KM/L</div>
                <div className="mono" style={{ fontWeight: 700 }}>{kmPerL.toFixed(1)}</div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 11 }}>Cost/km</div>
                <div className="mono" style={{ fontWeight: 700 }}>฿{costPerKm.toFixed(2)}</div>
              </div>
            </div>

            {weightLossExceeds && (
              <div style={{ marginBottom: 14, padding: '8px 12px', border: '1px solid #A32D2D', borderRadius: 4, color: '#A32D2D', fontSize: 12, fontWeight: 600 }}>
                ⚠ น้ำหนักสูญหายเกิน 5% ({weightLossPct.toFixed(1)}%)
              </div>
            )}

            <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 36, fontSize: 12 }}>คนขับ</div>
                <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 36, fontSize: 12 }}>ผู้ตรวจรับ</div>
                <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KPIProps {
  ic: string
  iconBg: string
  label: string
  value: React.ReactNode
  unit: string
  subtext: string
}

function KPICard({ ic, iconBg, label, value, unit, subtext }: KPIProps) {
  return (
    <div className="card kpi">
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <div className={`icn-box ${iconBg}`} style={{ width: 28, height: 28 }}>
          <Icon name={ic} size={14}/>
        </div>
        <div className="label" style={{ marginTop: 4 }}>{label}</div>
      </div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8, letterSpacing: '-.01em' }}>
        {value} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{subtext}</div>
    </div>
  )
}

// ─── Tab 3: รายงานสรุป ────────────────────────────────────────────────────────

function DispatchReportTab() {
  const all = db.getAll<Dispatch>('dispatch')
  const [month, setMonth] = useState('2026-05')
  const [statusF, setStatusF] = useState('all')
  const [vehicleF, setVehicleF] = useState('all')
  const [q, setQ] = useState('')
  const [onlyAbnormal, setOnlyAbnormal] = useState(false)

  const filtered = all.filter(t => {
    if (statusF !== 'all' && t.status !== statusF) return false
    if (vehicleF !== 'all' && t.vehicleId !== vehicleF) return false
    if (q) {
      const qq = q.toLowerCase()
      if (!t.code.toLowerCase().includes(qq) && !db.nameOf('customers', t.customerId).toLowerCase().includes(qq)) return false
    }
    if (onlyAbnormal && !(t.kmPerL && t.kmPerL < 2.5)) return false
    return true
  })

  const totalRounds = filtered.length
  const totalLegs = filtered.reduce((s, t) => s + db.legsOf(t).length, 0)
  const totalKm = filtered.reduce((s, t) => s + (t.distance || 0), 0)
  const totalRev = filtered.reduce((s, t) => s + db.amountOf(t), 0)
  const withKmL = filtered.filter(t => t.kmPerL)
  const avgKmL = withKmL.length > 0 ? withKmL.reduce((s, t) => s + (t.kmPerL ?? 0), 0) / withKmL.length : null

  const vehicles = db.getAll<{ id: string; plate: string }>('vehicles')

  return (
    <div>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">รายงานสรุปการขนส่ง</h1>
          <div className="page-sub">สรุปข้อมูลรอบงาน รายได้ และสถานะ</div>
        </div>
        <div className="spacer"/>
        <button className="btn"><PrintIcon/> <span style={{ marginLeft: 4 }}>พิมพ์รายงาน (A4)</span></button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 18 }}>
        <KPICard ic="package" iconBg="" label="รอบงานทั้งหมด" value={totalRounds} unit="รอบ" subtext={`ปิดแล้ว ${filtered.filter(t => t.status === 'completed').length} รอบ`}/>
        <KPICard ic="trip" iconBg="violet" label="ขารวม" value={totalLegs} unit="ขา" subtext={totalRounds > 0 ? `เฉลี่ย ${(totalLegs / totalRounds).toFixed(1)} ขา/รอบ` : '—'}/>
        <KPICard ic="gauge" iconBg="teal" label="ระยะทางรวม" value={db.fmt(totalKm)} unit="km" subtext="—"/>
        <KPICard ic="fuel" iconBg="amber" label="เฉลี่ย km/l" value={avgKmL ? avgKmL.toFixed(1) : 'ไม่มีข้อมูล'} unit={avgKmL ? 'km/l' : ''} subtext={`${withKmL.length} รอบมีข้อมูล`}/>
        <KPICard ic="money" iconBg="green" label="รายได้รวม" value={db.thb(totalRev).replace('฿', '')} unit="บาท" subtext="—"/>
      </div>

      {/* Filter row */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 6, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }}>
            <Icon name="calendar" size={14} style={{ color: 'var(--text-faint)' }}/>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, height: 24, padding: 0, background: 'transparent' }}/>
          </div>
          <div className="row" style={{ gap: 6, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', height: 38 }}>
            <Icon name="filter" size={14} style={{ color: 'var(--text-faint)' }}/>
            <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, height: 36, background: 'transparent' }}>
              <option value="all">สถานะทั้งหมด</option>
              <option value="scheduled">ร่าง</option>
              <option value="in-progress">กำลังดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
          <div className="row" style={{ gap: 6, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', height: 38 }}>
            <Icon name="truck" size={14} style={{ color: 'var(--text-faint)' }}/>
            <select value={vehicleF} onChange={e => setVehicleF(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, height: 36, background: 'transparent' }}>
              <option value="all">รถทั้งหมด</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
            </select>
          </div>
          <div className="row" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 11, color: 'var(--text-faint)' }}/>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ค้นหา Job No, ลูกค้า, คนขับ..."
              style={{ width: '100%', height: 38, padding: '0 12px 0 32px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', fontSize: 13 }}
            />
          </div>
          <button
            className={`chip ${onlyAbnormal ? 'active' : ''}`}
            style={{ background: onlyAbnormal ? 'var(--red)' : '#fff', borderColor: onlyAbnormal ? 'var(--red)' : 'var(--line)', color: onlyAbnormal ? '#fff' : 'var(--text-2)', height: 38 }}
            onClick={() => setOnlyAbnormal(o => !o)}
          >
            <Icon name="alert" size={13}/> แสดงเฉพาะผิดปกติ &lt; 2.5 km/l
          </button>
        </div>

        {/* Legend */}
        <div className="row" style={{ gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}><FuelBadgeIcon/> เกณฑ์ km/l:</span>
          <span className="badge green"><Icon name="check" size={11}/> ผ่านเกณฑ์ ≥ 2.5 km/l</span>
          <span className="badge red"><Icon name="alert" size={11}/> ผิดปกติ &lt; 2.5 km/l</span>
        </div>
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Job No</th>
              <th>วันที่</th>
              <th>รถ / คนขับ</th>
              <th className="right">ขา</th>
              <th className="right">ไมล์เปิด</th>
              <th className="right">ไมล์ปิด</th>
              <th className="right">km</th>
              <th className="right">km/l</th>
              <th className="right">ค่าขนส่ง (บาท)</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const legs = db.legsOf(t).length
              const abnormal = t.kmPerL && t.kmPerL < 2.5
              return (
                <tr key={t.id}>
                  <td><span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{t.code}</span></td>
                  <td className="num muted">{db.thaiDate(t.date)}</td>
                  <td>
                    <div className="mono" style={{ fontSize: 12.5 }}>{db.nameOf('vehicles', t.vehicleId ?? '')}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{db.nameOf('employees', t.driverId ?? '')}</div>
                  </td>
                  <td className="right"><span className="badge blue mono">{legs}</span></td>
                  <td className="num right muted">{t.startOdometer ? db.fmt(t.startOdometer) : '—'}</td>
                  <td className="num right muted">{t.endOdometer ? db.fmt(t.endOdometer) : '—'}</td>
                  <td className="num right">{t.distance ? db.fmt(t.distance) : '—'}</td>
                  <td className="num right">
                    {t.kmPerL ? (
                      <span className="mono" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: abnormal ? 'var(--red-50)' : 'var(--green-50)', color: abnormal ? 'var(--red)' : '#166534' }}>
                        {t.kmPerL.toFixed(1)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="num right" style={{ fontWeight: 600 }}>{db.fmt(db.amountOf(t))}</td>
                  <td><StatusBadge status={t.status}/></td>
                </tr>
              )
            })}
            <tr style={{ background: 'var(--bg-sunk)', fontWeight: 700 }}>
              <td colSpan={8} className="right">รวมค่าขนส่งทั้งหมด:</td>
              <td className="num right mono" style={{ color: 'var(--primary)', fontSize: 14 }}>{db.fmt(totalRev)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty">ไม่พบงานที่ตรงกับเงื่อนไข</div>
        )}
      </div>
    </div>
  )
}

// ─── Tab 4: ประวัติงาน ───────────────────────────────────────────────────────

function DispatchHistoryTab() {
  const all = db.getAll<Dispatch>('dispatch').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const filtered = all.filter(t => {
    if (statusF !== 'all' && t.status !== statusF) return false
    if (q) {
      const qq = q.toLowerCase()
      if (
        !t.code.toLowerCase().includes(qq) &&
        !db.nameOf('vehicles', t.vehicleId ?? '').toLowerCase().includes(qq) &&
        !db.nameOf('employees', t.driverId ?? '').toLowerCase().includes(qq) &&
        !db.originOf(t).toLowerCase().includes(qq) &&
        !db.destOf(t).toLowerCase().includes(qq)
      ) return false
    }
    return true
  })

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">ประวัติการวิ่งงาน</h1>
        <div className="page-sub">ดูประวัติงานทั้งหมด รองรับหลายขาต่อรอบ</div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="row" style={{ position: 'relative', flex: 1 }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 11, color: 'var(--text-faint)' }}/>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ค้นหา Job No, ทะเบียนรถ, คนขับ, สินค้า, เส้นทาง..."
              style={{ width: '100%', height: 38, padding: '0 12px 0 32px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }}
            />
          </div>
          <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ height: 38, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', fontSize: 13 }}>
            <option value="all">ทุกสถานะ</option>
            <option value="scheduled">ร่าง</option>
            <option value="in-progress">กำลังดำเนินการ</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
          <span className="muted mono" style={{ fontSize: 12, alignSelf: 'center' }}>{filtered.length} รายการ</span>
        </div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {filtered.map(t => {
          const legs = db.legsOf(t)
          const v = db.get<{ id: string; plate: string; brand: string }>('vehicles', t.vehicleId ?? '')
          const dr = db.get<{ id: string; name: string }>('employees', t.driverId ?? '')
          const isOpen = expanded[t.id]
          const abnormal = t.kmPerL && t.kmPerL < 2.5
          const statusColor = t.status === 'completed' ? 'green' : t.status === 'in-progress' ? 'amber' : t.status === 'cancelled' ? 'red' : 'gray'

          return (
            <div key={t.id} className="card" style={{ overflow: 'hidden' }}>
              <div
                className="row"
                style={{ padding: '16px 20px', cursor: 'pointer', gap: 14 }}
                onClick={() => setExpanded(e => ({ ...e, [t.id]: !e[t.id] }))}
              >
                {/* Icon dot */}
                <div className="avatar" style={{
                  width: 40, height: 40, borderRadius: 999,
                  background: statusColor === 'green' ? 'var(--green-50)' : statusColor === 'amber' ? 'var(--amber-50)' : statusColor === 'red' ? 'var(--red-50)' : 'var(--bg-sunk)',
                  color: statusColor === 'green' ? 'var(--green)' : statusColor === 'amber' ? 'var(--amber)' : statusColor === 'red' ? 'var(--red)' : 'var(--text-muted)',
                }}>
                  <TruckIcon/>
                </div>

                {/* Main */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: 14 }}>{t.code}</span>
                    <StatusBadge status={t.status}/>
                    <span className="badge blue">{legs.length} ขา</span>
                    {t.kmPerL != null && (
                      <span className={`badge ${abnormal ? 'red' : 'green'}`}>
                        <FuelBadgeIcon/> {t.kmPerL.toFixed(1)} km/l
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 16, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span><Icon name="calendar" size={12}/> {db.thaiDate(t.date)}</span>
                    {v && (
                      <span className="row" style={{ gap: 4 }}>
                        <Icon name="truck" size={12}/> <span className="mono">{v.plate}</span>
                        {dr && <span>({dr.name})</span>}
                      </span>
                    )}
                    <span>{db.originOf(t)} {legs.length > 2 ? ' → ... → ' : ' → '} {db.destOf(t)}</span>
                  </div>
                </div>

                {/* Right */}
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                    {db.fmt(db.amountOf(t))} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>บาท</span>
                  </div>
                  {(t.distance ?? 0) > 0 && <div className="muted mono" style={{ fontSize: 11.5 }}>{db.fmt(t.distance)} km</div>}
                </div>
                <Icon name="chevron-down" size={16} style={{ color: 'var(--text-faint)', transform: isOpen ? 'rotate(180deg)' : '', transition: 'transform .15s' }}/>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--line)', padding: 20, background: 'var(--bg)' }}>
                  <div className="grid-3" style={{ marginBottom: 14 }}>
                    <Info label="วันที่" value={db.thaiDate(t.date)}/>
                    <Info label="รถ" value={v ? `${v.plate} • ${v.brand}` : '—'}/>
                    <Info label="คนขับ" value={dr?.name || '—'}/>
                    {t.startOdometer != null && <Info label="ไมล์เปิด" value={<span className="mono">{db.fmt(t.startOdometer)} km</span>}/>}
                    {t.endOdometer != null && <Info label="ไมล์ปิด" value={<span className="mono">{db.fmt(t.endOdometer)} km</span>}/>}
                    {t.liters != null && <Info label="น้ำมันที่ใช้" value={<span className="mono">{t.liters} ลิตร</span>}/>}
                  </div>

                  <h3 className="section-title">เส้นทาง</h3>
                  <div className="col" style={{ gap: 8, marginBottom: 14 }}>
                    {legs.map((leg, i) => (
                      <div key={i} className="row" style={{ padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{leg.origin} → {leg.destination}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>
                            {leg.cargo} {leg.weight > 0 && `• ${leg.weight} ${leg.priceMode === 'per_kg' ? 'กก.' : 'ตัน'}`} • {leg.priceMode === 'lump' ? 'เหมา' : leg.priceMode === 'per_kg' ? 'ต่อกก.' : 'ต่อตัน'} ฿{db.fmt(leg.price)}
                          </div>
                        </div>
                        <div className="mono" style={{ fontWeight: 600 }}>{db.thb(leg.amount)}</div>
                      </div>
                    ))}
                  </div>

                  {t.notes && t.notes !== '—' && (
                    <div style={{ padding: '10px 14px', background: 'var(--amber-50)', borderRadius: 8, fontSize: 12.5 }}>
                      <strong>หมายเหตุ:</strong> {t.notes}
                    </div>
                  )}

                  <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                    <button className="btn sm"><PrintIcon/> <span style={{ marginLeft: 4 }}>พิมพ์</span></button>
                    {t.status === 'in-progress' && (
                      <button className="btn sm primary"><Icon name="check" size={13}/> ไปปิดงาน</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card"><div className="empty">ไม่พบประวัติที่ตรงกับเงื่อนไข</div></div>
        )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function DispatchModule({ tab, setActive }: DispatchModuleProps) {
  const valid = ['open', 'close', 'fuel', 'monthly', 'report', 'history']
  const currentTab = valid.includes(tab) ? tab : 'open'

  return (
    <div>
      <div className="no-print">
        <DispatchTabs current={currentTab} onChange={t => setActive('dispatch.' + t)}/>
      </div>
      <div style={{ marginTop: 20 }}>
        {currentTab === 'open'    && <DispatchOpenForm setActive={setActive}/>}
        {currentTab === 'close'   && <DispatchCloseForm/>}
        {currentTab === 'fuel'    && <DispatchFuelReport/>}
        {currentTab === 'monthly' && <DispatchMonthlyReport/>}
        {currentTab === 'report'  && <DispatchReportTab/>}
        {currentTab === 'history' && <DispatchHistoryTab/>}
      </div>
    </div>
  )
}
