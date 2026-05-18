import { useState, useMemo, useEffect } from 'react'
import { db, uid } from '../../lib/db'
import type { Vehicle, Employee, Dispatch, DispatchLeg, User } from '../../types'
import { Icon, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
  subject: unknown
  user: User
}

interface ToastState { kind: 'success' | 'error'; msg: string }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2800)
    return () => clearTimeout(t)
  }, [toast, onClose])
  const ok = toast.kind === 'success'
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 110, right: 24, zIndex: 1200,
        background: ok ? '#10B981' : '#EF4444', color: '#fff',
        padding: '12px 18px', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 14, fontWeight: 500,
        minWidth: 260,
      }}
    >{toast.msg}</div>
  )
}

interface LegForm {
  id: string
  origin: string
  destination: string
  cargo: string
  cargoType: string
  priceMode: 'per_ton' | 'per_kg' | 'lump'
  weight: string
  price: string
  notes: string
}

const emptyLeg = (): LegForm => ({
  id: uid('lg'),
  origin: '',
  destination: '',
  cargo: '',
  cargoType: '',
  priceMode: 'per_ton',
  weight: '',
  price: '',
  notes: '',
})

function calcFreight(l: LegForm | DispatchLeg): number {
  const weight = Number((l as LegForm).weight ?? (l as DispatchLeg).weight) || 0
  const price = Number((l as LegForm).price ?? (l as DispatchLeg).price) || 0
  const mode = (l as LegForm).priceMode ?? (l as DispatchLeg).priceMode
  if (mode === 'lump') return price
  if (mode === 'per_kg') return weight * 1000 * price
  return weight * price // per_ton
}

function priceUnit(mode: LegForm['priceMode']): string {
  if (mode === 'lump') return 'บาท'
  if (mode === 'per_kg') return 'บาท/กก.'
  return 'บาท/ตัน'
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function thaiBuddhistYear(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

function LegCard({
  data, index, collapsed, canRemove, onToggle, onChange, onRemove,
}: {
  data: LegForm
  index: number
  collapsed: boolean
  canRemove: boolean
  onToggle: () => void
  onChange: (patch: Partial<LegForm>) => void
  onRemove: () => void
}) {
  const freight = calcFreight(data)
  const hasRoute = data.origin.trim() && data.destination.trim()
  const isLump = data.priceMode === 'lump'

  return (
    <div
      className="card"
      style={{ padding: 0, marginBottom: 12, border: hasRoute ? '1px solid var(--line)' : '1px dashed var(--line)' }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: '12px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: collapsed ? 'none' : '1px solid var(--line)',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: hasRoute ? 'var(--primary)' : 'var(--bg)',
            color: hasRoute ? '#fff' : 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13,
          }}
        >{index + 1}</span>
        <span style={{ fontWeight: 600, flex: 1 }}>
          ขา {index + 1}
          {hasRoute
            ? <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>— {data.origin} → {data.destination}</span>
            : <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>— ยังไม่ได้กรอกข้อมูล</span>
          }
        </span>
        <span className="mono" style={{ fontWeight: 600, color: freight > 0 ? 'var(--green)' : 'var(--text-2)' }}>
          ฿{db.fmt(freight)}
        </span>
        <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={16} />
      </div>
      {!collapsed && (
        <div style={{ padding: 16 }}>
          <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
            <Field label="ต้นทาง *">
              <input value={data.origin} onChange={e => onChange({ origin: e.target.value })} placeholder="เช่น นครราชสีมา" />
            </Field>
            <Field label="ปลายทาง *">
              <input value={data.destination} onChange={e => onChange({ destination: e.target.value })} placeholder="เช่น ขอนแก่น" />
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
            <Field label="สินค้า *">
              <input value={data.cargo} onChange={e => onChange({ cargo: e.target.value })} placeholder="ระบุชื่อสินค้า" />
            </Field>
            <Field label="ประเภทสินค้า">
              <input value={data.cargoType} onChange={e => onChange({ cargoType: e.target.value })} placeholder="เช่น ข้าวสาร, ปูน" />
            </Field>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>รูปแบบราคา *</label>
            <div className="row" style={{ gap: 16 }}>
              {([
                { v: 'per_ton', l: 'ต่อตัน' },
                { v: 'per_kg', l: 'ต่อกิโลกรัม' },
                { v: 'lump', l: 'เหมา' },
              ] as const).map(opt => (
                <label key={opt.v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="radio"
                    name={`pm-${data.id}`}
                    checked={data.priceMode === opt.v}
                    onChange={() => onChange({ priceMode: opt.v })}
                  />
                  <span>{opt.l}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
            {!isLump && (
              <Field label="น้ำหนัก (ตัน)">
                <input
                  type="number"
                  step="0.01"
                  value={data.weight}
                  onChange={e => onChange({ weight: e.target.value })}
                  placeholder="0.00"
                />
              </Field>
            )}
            <Field label={`ราคา (${priceUnit(data.priceMode)}) *`}>
              <input
                type="number"
                step="0.01"
                value={data.price}
                onChange={e => onChange({ price: e.target.value })}
                placeholder="0"
              />
            </Field>
            {isLump && <div />}
          </div>

          <div
            style={{
              padding: 12, marginTop: 6, borderRadius: 8,
              background: 'var(--primary-tint, #EFF6FF)', border: '1px solid #BFDBFE',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 13,
            }}
          >
            <span className="row" style={{ gap: 8 }}>
              <Icon name="money" size={16} />
              <strong>ค่าขนส่งขานี้:</strong>
            </span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
              {db.fmt(freight)} บาท
            </span>
          </div>

          {canRemove && (
            <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                className="btn ghost sm"
                onClick={onRemove}
                style={{ color: 'var(--red)' }}
              >
                <Icon name="close" size={13} /> ลบขานี้
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DispatchRoundOpen({ setActive, setSubject, subject, user }: Props) {
  const subj = subject as { type?: string; id?: string } | null
  const editingId = subj?.type === 'round' ? subj.id : undefined
  const existing = editingId ? db.get<Dispatch>('dispatch', editingId) : undefined

  const vehicles = useMemo(() => db.getAll<Vehicle>('vehicles'), [])
  const employees = useMemo(() => db.getAll<Employee>('employees'), [])
  const drivers = employees.filter(e => e.position === 'คนขับ')

  // Form state
  const [date, setDate] = useState(existing?.date || todayISO())
  const [vehicleId, setVehicleId] = useState(existing?.vehicleId || '')
  const [driverId, setDriverId] = useState(existing?.driverId || (user.role === 'driver' ? user.id : ''))
  const [startMileage, setStartMileage] = useState(
    existing?.startOdometer != null ? String(existing.startOdometer) : '',
  )
  const [notes, setNotes] = useState(existing?.notes || '')
  const [legs, setLegs] = useState<LegForm[]>(() => {
    if (existing?.legs?.length) {
      return existing.legs.map(l => ({
        id: l.id || uid('lg'),
        origin: l.origin || '',
        destination: l.destination || '',
        cargo: l.cargo || '',
        cargoType: l.cargoType || '',
        priceMode: l.priceMode || 'per_ton',
        weight: l.weight ? String(l.weight) : '',
        price: l.price ? String(l.price) : '',
        notes: l.notes || '',
      }))
    }
    return [emptyLeg()]
  })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<ToastState | null>(null)
  const [saving, setSaving] = useState(false)

  // Auto-fill mileage from last closed round when vehicle changes (only for NEW rounds)
  useEffect(() => {
    if (existing) return
    if (!vehicleId) return
    const last = db.lastClosedMileage(vehicleId)
    if (last != null) setStartMileage(String(last))
    else {
      const v = vehicles.find(x => x.id === vehicleId)
      if (v?.odometer) setStartMileage(String(v.odometer))
    }
  }, [vehicleId])

  const vehicle = vehicles.find(v => v.id === vehicleId)
  const totalFreight = legs.reduce((s, l) => s + calcFreight(l), 0)
  const totalWeight = legs.reduce((s, l) => s + (Number(l.weight) || 0), 0)

  const addLeg = () => {
    const next = emptyLeg()
    setLegs(ls => [...ls, next])
  }
  const setLeg = (i: number, patch: Partial<LegForm>) =>
    setLegs(ls => ls.map((l, ix) => (ix === i ? { ...l, ...patch } : l)))
  const removeLeg = (i: number) => setLegs(ls => ls.filter((_, ix) => ix !== i))
  const toggleCollapse = (id: string) =>
    setCollapsed(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })

  const validate = (strict: boolean): string | null => {
    if (!vehicleId) return 'กรุณาเลือกรถ'
    if (!driverId) return 'กรุณาเลือกคนขับ'
    if (!date) return 'กรุณาระบุวันที่'
    if (!startMileage || isNaN(Number(startMileage))) return 'เลขไมล์ต้นรอบไม่ถูกต้อง'
    if (strict) {
      for (let i = 0; i < legs.length; i++) {
        const l = legs[i]
        if (!l.origin.trim()) return `ขา ${i + 1}: กรอกต้นทาง`
        if (!l.destination.trim()) return `ขา ${i + 1}: กรอกปลายทาง`
        if (!l.cargo.trim()) return `ขา ${i + 1}: กรอกชื่อสินค้า`
        if (!Number(l.price)) return `ขา ${i + 1}: กรอกราคา`
        if (l.priceMode !== 'lump' && !Number(l.weight)) return `ขา ${i + 1}: กรอกน้ำหนัก`
      }
    }
    return null
  }

  const submit = (mode: 'draft' | 'open') => {
    if (saving) return
    const err = validate(mode === 'open')
    if (err) { setToast({ kind: 'error', msg: err }); return }
    setSaving(true)
    try {
      const legPayload: DispatchLeg[] = legs.map(l => ({
        id: l.id,
        origin: l.origin.trim(),
        destination: l.destination.trim(),
        cargo: l.cargo.trim(),
        cargoType: l.cargoType.trim(),
        priceMode: l.priceMode,
        weight: Number(l.weight) || 0,
        price: Number(l.price) || 0,
        amount: calcFreight(l),
        notes: l.notes.trim() || undefined,
        deliveredWeight: null,
        perDiem: 0,
      }))
      const totalAmount = legPayload.reduce((s, l) => s + l.amount, 0)
      const dispatchDateTime = `${date}T08:00`

      const payload: Partial<Dispatch> = {
        customerId: '',
        driverId,
        vehicleId,
        subcontractorId: null,
        date,
        depart: dispatchDateTime,
        eta: '',
        status: 'scheduled',
        progress: 0,
        startOdometer: Number(startMileage),
        endOdometer: existing?.endOdometer ?? null,
        distance: null,
        liters: null,
        kmPerL: null,
        perDiem: null,
        notes,
        legs: legPayload,
        totalAmount,
        revenue: totalAmount,
        cost: existing?.cost ?? 0,
        roundStatus: 'draft',
        otherExpenses: existing?.otherExpenses ?? [],
      }

      let saved: Dispatch
      if (existing) {
        saved = db.update<Dispatch>('dispatch', existing.id, payload)
      } else {
        saved = db.add<Partial<Dispatch>>('dispatch', { code: db.nextRoundCode(), ...payload }) as Dispatch
      }

      setToast({
        kind: 'success',
        msg: mode === 'open' ? `✅ เปิดงาน ${saved.code} เรียบร้อย` : '✅ บันทึกร่างเรียบร้อย',
      })
      setTimeout(() => {
        if (mode === 'open') {
          setSubject(null)
          setActive('dispatch.history')
        } else {
          if (!existing) setSubject({ type: 'round', id: saved.id })
          setSaving(false)
        }
      }, 800)
    } catch (err) {
      setToast({ kind: 'error', msg: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ' })
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{existing ? 'แก้ไขรอบงานขนส่ง' : 'เปิดงานขนส่ง'}</h1>
          <div className="page-sub">รองรับหลายขา (Multi-leg) ในรอบเดียว</div>
        </div>
        <div className="actions">
          <span className="badge" style={{ fontSize: 12 }}>{thaiBuddhistYear(date)}</span>
        </div>
      </div>

      {/* Card 1: ข้อมูลรถและคนขับ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="head">
          <h3><Icon name="truck" size={16} /> ข้อมูลรถและคนขับ</h3>
        </div>
        <div style={{ padding: 18 }}>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="วันที่ *">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="รถ *">
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                <option value="">-- เลือกรถ --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} ({v.brand} · {v.type})</option>
                ))}
              </select>
            </Field>
            <Field label="คนขับ *">
              <select value={driverId} onChange={e => setDriverId(e.target.value)}>
                <option value="">-- เลือกคนขับ --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="เลขไมล์ต้นรอบ (km)">
              <input
                type="number"
                value={startMileage}
                onChange={e => setStartMileage(e.target.value)}
                placeholder="0"
              />
              {vehicle && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  อิงจากเที่ยวก่อนหน้าของรถคันนี้ (แก้ไขได้)
                </div>
              )}
            </Field>
            <Field label="หมายเหตุรอบงาน">
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ระบุหมายเหตุ (ถ้ามี)" />
            </Field>
          </div>
        </div>
      </div>

      {/* Card 2: เส้นทางและสินค้า */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="head">
          <h3><Icon name="package" size={16} /> เส้นทางและสินค้า ({legs.length} ขา)</h3>
        </div>
        <div style={{ padding: 18 }}>
          {legs.map((leg, i) => (
            <LegCard
              key={leg.id}
              data={leg}
              index={i}
              collapsed={collapsed.has(leg.id)}
              canRemove={legs.length > 1}
              onToggle={() => toggleCollapse(leg.id)}
              onChange={patch => setLeg(i, patch)}
              onRemove={() => removeLeg(i)}
            />
          ))}
          <button
            className="btn ghost"
            onClick={addLeg}
            style={{ width: '100%', borderStyle: 'dashed', padding: '12px' }}
          >
            <Icon name="plus" size={15} /> เพิ่มขาถัดไป
          </button>
        </div>
      </div>

      {/* Sticky footer */}
      <div
        style={{
          position: 'sticky', bottom: 0, zIndex: 50,
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 10, padding: '14px 18px',
          boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="muted" style={{ fontSize: 11 }}>รวมค่าขนส่งทั้งรอบ ({legs.length} ขา)</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>
            {db.fmt(totalFreight)} <span style={{ fontSize: 14, color: 'var(--text-2)' }}>บาท</span>
          </div>
          {totalWeight > 0 && (
            <div className="muted" style={{ fontSize: 11 }}>น้ำหนักรวม: {totalWeight.toFixed(2)} ตัน</div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div className="row btn-row">
          <button className="btn" onClick={() => setActive('dispatch.history')} disabled={saving}>
            <Icon name="close" size={15} /> ยกเลิก
          </button>
          <button className="btn" onClick={() => submit('draft')} disabled={saving}>
            <Icon name="check" size={15} /> บันทึกร่าง
          </button>
          <button className="btn primary" onClick={() => submit('open')} disabled={saving}>
            <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : `เปิดงาน (${legs.length} ขา)`}
          </button>
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
