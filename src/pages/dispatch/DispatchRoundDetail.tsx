import { useState, useMemo, useEffect } from 'react'
import { db, uid } from '../../lib/db'
import type { Vehicle, Employee, Dispatch, DispatchLeg, Customer } from '../../types'
import { Icon, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
  subject: unknown
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
        position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
        background: ok ? '#10B981' : '#EF4444', color: '#fff',
        padding: '12px 18px', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 14, fontWeight: 500,
        minWidth: 260,
      }}
    >{toast.msg}</div>
  )
}

interface LegFormState {
  origin: string
  destination: string
  customerId: string
  cargo: string
  cargoType: string
  weight: string
  freight: string
  legType: 'outbound' | 'backhaul' | 'return'
  notes: string
}

const EMPTY_LEG: LegFormState = {
  origin: '', destination: '', customerId: '', cargo: '', cargoType: '',
  weight: '', freight: '', legType: 'outbound', notes: '',
}

function legTypeLabel(t?: string): string {
  if (t === 'backhaul') return 'Backhaul'
  if (t === 'return') return 'Return (เปล่า)'
  return 'Outbound'
}

function LegModal({
  initial,
  customers,
  onSave,
  onCancel,
}: {
  initial: LegFormState
  customers: Customer[]
  onSave: (f: LegFormState) => void
  onCancel: () => void
}) {
  const [f, setF] = useState(initial)
  const set = <K extends keyof LegFormState>(k: K, v: LegFormState[K]) => setF(s => ({ ...s, [k]: v }))
  const isReturn = f.legType === 'return'

  const submit = () => {
    if (!f.origin.trim()) return alert('กรุณากรอกต้นทาง')
    if (!f.destination.trim()) return alert('กรุณากรอกปลายทาง')
    if (!isReturn) {
      if (!f.customerId) return alert('กรุณาเลือกลูกค้า')
      if (!Number(f.weight)) return alert('กรุณากรอกน้ำหนักโหลด')
      if (!Number(f.freight)) return alert('กรุณากรอกค่าขนส่ง')
    }
    onSave(f)
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 12, width: '95%', maxWidth: 640,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>ข้อมูลขา</h2>
        </div>
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="ประเภทขา">
            <select value={f.legType} onChange={e => set('legType', e.target.value as LegFormState['legType'])}>
              <option value="outbound">Outbound (เที่ยวไป)</option>
              <option value="backhaul">Backhaul (เที่ยวกลับ มีสินค้า)</option>
              <option value="return">Return (เที่ยวกลับ เปล่า)</option>
            </select>
          </Field>
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="ต้นทาง *">
              <input value={f.origin} onChange={e => set('origin', e.target.value)} placeholder="เช่น โรงงาน KPS" />
            </Field>
            <Field label="ปลายทาง *">
              <input value={f.destination} onChange={e => set('destination', e.target.value)} placeholder="เช่น กรุงเทพ" />
            </Field>
          </div>
          {!isReturn && (
            <>
              <Field label="ลูกค้า *">
                <select value={f.customerId} onChange={e => set('customerId', e.target.value)}>
                  <option value="">-- เลือก --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <div className="grid-2" style={{ gap: 12 }}>
                <Field label="ประเภทสินค้า">
                  <input value={f.cargoType} onChange={e => set('cargoType', e.target.value)} placeholder="เช่น ปูนซีเมนต์" />
                </Field>
                <Field label="รายละเอียดสินค้า">
                  <input value={f.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Optional" />
                </Field>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <Field label="น้ำหนักโหลด (ตัน) *">
                  <input type="number" step="0.01" value={f.weight} onChange={e => set('weight', e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="ค่าขนส่ง (฿) *">
                  <input type="number" value={f.freight} onChange={e => set('freight', e.target.value)} placeholder="0" />
                </Field>
              </div>
            </>
          )}
          <Field label="หมายเหตุ">
            <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ resize: 'vertical', minHeight: 56 }} />
          </Field>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)' }}>
          <div className="row btn-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onCancel}>
              <Icon name="close" size={15} /> ยกเลิก
            </button>
            <button className="btn primary" onClick={submit}>
              <Icon name="check" size={15} /> บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DispatchRoundDetail({ setActive, setSubject, subject }: Props) {
  const subj = subject as { type?: string; id?: string } | null
  const [tick, setTick] = useState(0)
  const round = useMemo(
    () => (subj?.id ? db.get<Dispatch>('dispatch', subj.id) : undefined),
    [subj?.id, tick],
  )
  const vehicles = db.getAll<Vehicle>('vehicles')
  const employees = db.getAll<Employee>('employees')
  const customers = db.getAll<Customer>('customers')

  const [editingLeg, setEditingLeg] = useState<{ index: number; data: LegFormState } | null>(null)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  if (!round) {
    return (
      <div className="empty">
        ไม่พบรอบงาน —{' '}
        <a onClick={() => setActive('dispatch.open')} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
          กลับ
        </a>
      </div>
    )
  }

  const isClosed = round.roundStatus === 'closed'
  const vehicle = vehicles.find(v => v.id === round.vehicleId)
  const driver = employees.find(e => e.id === round.driverId)
  const legs = round.legs ?? []
  const totalRevenue = db.roundRevenue(round)
  const totalWeight = legs.reduce((s, l) => s + (l.weight || 0), 0)

  const saveLeg = (form: LegFormState) => {
    if (!editingLeg) return
    const freight = Number(form.freight) || 0
    const weight = Number(form.weight) || 0
    const newLeg: DispatchLeg = {
      id: editingLeg.index >= 0 && legs[editingLeg.index]?.id
        ? legs[editingLeg.index].id
        : uid('lg'),
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      customerId: form.customerId || undefined,
      cargo: form.cargo.trim(),
      cargoType: form.cargoType.trim(),
      priceMode: 'lump',
      weight,
      price: freight,
      amount: freight,
      legType: form.legType,
      notes: form.notes.trim() || undefined,
      deliveredWeight: legs[editingLeg.index]?.deliveredWeight ?? null,
      perDiem: legs[editingLeg.index]?.perDiem ?? 0,
      closed: false,
    }
    const next = [...legs]
    if (editingLeg.index < 0) next.push(newLeg)
    else next[editingLeg.index] = newLeg
    const newRevenue = next.reduce((s, l) => s + (l.amount || 0), 0)
    db.update<Dispatch>('dispatch', round.id, {
      legs: next,
      totalAmount: newRevenue,
      revenue: newRevenue,
    })
    setEditingLeg(null)
    setTick(t => t + 1)
    setToast({ kind: 'success', msg: '✅ บันทึกขาเรียบร้อย' })
  }

  const deleteLeg = (i: number) => {
    const next = legs.filter((_, ix) => ix !== i)
    const newRevenue = next.reduce((s, l) => s + (l.amount || 0), 0)
    db.update<Dispatch>('dispatch', round.id, {
      legs: next,
      totalAmount: newRevenue,
      revenue: newRevenue,
    })
    setDeletingIndex(null)
    setTick(t => t + 1)
    setToast({ kind: 'success', msg: '✅ ลบขาเรียบร้อย' })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div
            className="row"
            style={{ gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            onClick={() => setActive('dispatch.open')}
          >
            <span>← รายการรอบงาน</span>
          </div>
          <h1 className="page-title">
            <span className="mono" style={{ color: 'var(--primary)' }}>{round.code}</span>
            {isClosed
              ? <span className="badge green" style={{ marginLeft: 12, fontSize: 11 }}>CLOSED</span>
              : <span className="badge amber" style={{ marginLeft: 12, fontSize: 11 }}>DRAFT</span>
            }
          </h1>
          <div className="page-sub">
            {vehicle?.plate ?? '—'} ({vehicle?.brand ?? '—'} · {vehicle?.type ?? '—'})
            {' • '}คนขับ {driver?.name ?? '—'}
            {' • '}ออก {db.thaiDate(round.depart || round.date)}
          </div>
        </div>
        {!isClosed && (
          <div className="actions">
            <button
              className="btn primary"
              onClick={() => {
                setSubject({ type: 'round', id: round.id })
                setActive('dispatch.close')
              }}
              disabled={legs.length === 0}
              title={legs.length === 0 ? 'เพิ่มขาอย่างน้อย 1 ขาก่อน' : ''}
            >
              <Icon name="check" size={15} /> ไปปิดงาน →
            </button>
          </div>
        )}
      </div>

      {/* Round info */}
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="grid-4" style={{ gap: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>เลขไมล์ต้นรอบ</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{db.fmt(round.startOdometer)} km</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>จำนวนขา</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{legs.length} ขา</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>น้ำหนักโหลดรวม</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{totalWeight.toFixed(2)} ตัน</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>รายได้รวม</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)' }}>{db.thb(totalRevenue)}</div>
          </div>
        </div>
        {round.notes && (
          <div style={{ marginTop: 14, padding: 10, background: 'var(--bg)', borderRadius: 6, fontSize: 13 }}>
            <span className="muted" style={{ fontSize: 11 }}>หมายเหตุรอบ: </span>{round.notes}
          </div>
        )}
      </div>

      {/* Legs */}
      <div className="card">
        <div className="head">
          <h3>ขาในรอบนี้ ({legs.length})</h3>
          {!isClosed && (
            <div className="right">
              <button
                className="btn primary sm"
                onClick={() => setEditingLeg({ index: -1, data: { ...EMPTY_LEG } })}
              >
                <Icon name="plus" size={14} /> เพิ่มขาใหม่
              </button>
            </div>
          )}
        </div>
        {legs.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>
            ยังไม่มีขา —{' '}
            {!isClosed && (
              <a
                onClick={() => setEditingLeg({ index: -1, data: { ...EMPTY_LEG } })}
                style={{ cursor: 'pointer', color: 'var(--primary)' }}
              >
                เพิ่มขาแรก
              </a>
            )}
          </div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>ขา</th>
                  <th>เส้นทาง</th>
                  <th>ลูกค้า</th>
                  <th>สินค้า</th>
                  <th>ประเภท</th>
                  <th className="num">น้ำหนัก (ตัน)</th>
                  <th className="num right">ค่าขนส่ง</th>
                  {!isClosed && <th></th>}
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={l.id || i}>
                    <td style={{ fontWeight: 600 }}>{i + 1}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{l.origin}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>→ {l.destination}</div>
                    </td>
                    <td>{l.customerId ? db.nameOf('customers', l.customerId) : <span className="muted">—</span>}</td>
                    <td>{l.cargoType || <span className="muted">—</span>}</td>
                    <td><span className="badge" style={{ fontSize: 11 }}>{legTypeLabel(l.legType)}</span></td>
                    <td className="num">{(l.weight || 0).toFixed(2)}</td>
                    <td className="num right">{db.thb(l.amount)}</td>
                    {!isClosed && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button
                            className="btn ghost icon sm"
                            title="แก้ไข"
                            onClick={() => setEditingLeg({
                              index: i,
                              data: {
                                origin: l.origin,
                                destination: l.destination,
                                customerId: l.customerId || '',
                                cargo: l.cargo || '',
                                cargoType: l.cargoType || '',
                                weight: String(l.weight || ''),
                                freight: String(l.amount || ''),
                                legType: l.legType ?? 'outbound',
                                notes: l.notes || '',
                              },
                            })}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="btn ghost icon sm"
                            title="ลบ"
                            onClick={() => setDeletingIndex(i)}
                            style={{ color: 'var(--red)' }}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                <tr style={{ fontWeight: 600, background: 'var(--bg)' }}>
                  <td colSpan={5} className="right">รวม {legs.length} ขา</td>
                  <td className="num">{totalWeight.toFixed(2)}</td>
                  <td className="num right" style={{ color: 'var(--green)' }}>{db.thb(totalRevenue)}</td>
                  {!isClosed && <td></td>}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingLeg && (
        <LegModal
          initial={editingLeg.data}
          customers={customers}
          onSave={saveLeg}
          onCancel={() => setEditingLeg(null)}
        />
      )}

      {deletingIndex != null && (
        <div
          onClick={() => setDeletingIndex(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card)', borderRadius: 12, width: '90%', maxWidth: 400, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,.2)' }}
          >
            <h2 style={{ margin: '0 0 12px 0', fontSize: 17, fontWeight: 600 }}>ยืนยันลบขา</h2>
            <p style={{ margin: '0 0 22px 0', color: 'var(--text-2)', fontSize: 14 }}>
              ⚠️ แน่ใจหรือว่าต้องการลบขา {deletingIndex + 1}?
            </p>
            <div className="row btn-row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeletingIndex(null)}>ยกเลิก</button>
              <button className="btn danger solid" onClick={() => deleteLeg(deletingIndex)}>
                <Icon name="close" size={15} /> ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
