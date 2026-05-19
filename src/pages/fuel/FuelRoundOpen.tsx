import { useState, useMemo, useEffect } from 'react'
import { db, uid, DEFAULT_TANK_CAPACITY, HOME_BASE } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import type { Vehicle, Dispatch, FuelRound, FuelRefill } from '../../types'
import { Icon, StatusBadge, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
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

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function FuelRoundOpen({ setActive, setSubject }: Props) {
  const [tick, setTick] = useState(0)
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const allRounds = useMemo(() => db.getAll<FuelRound>('fuelRounds'), [tick])
  const openRounds = allRounds.filter(r => r.status === 'open')

  const [vehicleId, setVehicleId] = useState('')
  const [mileage, setMileage] = useState('')
  const [liters, setLiters] = useState(String(DEFAULT_TANK_CAPACITY))
  const [pricePerL, setPricePerL] = useState('35')
  const [startAt, setStartAt] = useState(nowLocal())
  const [tankCapacity, setTankCapacity] = useState(String(DEFAULT_TANK_CAPACITY))
  const [linkDispatchId, setLinkDispatchId] = useState('')
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)

  const vehicle = vehicles.find(v => v.id === vehicleId)
  const activeRoundForVehicle = vehicleId
    ? allRounds.find(r => r.vehicleId === vehicleId && r.status === 'open')
    : null
  const lastClosed = useMemo(() => {
    if (!vehicleId) return null
    const closed = allRounds
      .filter(r => r.vehicleId === vehicleId && r.status === 'closed')
      .sort((a, b) => {
        const ea = a.refills.find(x => x.type === 'end')?.at ?? ''
        const eb = b.refills.find(x => x.type === 'end')?.at ?? ''
        return eb.localeCompare(ea)
      })
    return closed[0] ?? null
  }, [vehicleId, allRounds])

  // Candidate dispatch rounds to link (DRAFT for this vehicle)
  const draftDispatches = useMemo(() => {
    if (!vehicleId) return []
    return db.getAll<Dispatch>('dispatch')
      .filter(d => d.vehicleId === vehicleId && d.roundStatus === 'draft')
  }, [vehicleId, tick])

  // Auto-fill mileage from vehicle's last known mileage
  useEffect(() => {
    if (!vehicleId) { setMileage(''); setLinkDispatchId(''); return }
    const lastMileage = db.lastClosedMileage(vehicleId)
    if (lastMileage != null) setMileage(String(lastMileage))
    else if (vehicle) setMileage(String(vehicle.odometer || ''))
    // Auto-link if exactly one DRAFT dispatch round
    const drafts = db.getAll<Dispatch>('dispatch').filter(d => d.vehicleId === vehicleId && d.roundStatus === 'draft')
    if (drafts.length === 1) setLinkDispatchId(drafts[0].id)
    else setLinkDispatchId('')
  }, [vehicleId])

  const totalCost = (Number(liters) || 0) * (Number(pricePerL) || 0)

  const submit = () => {
    if (!vehicleId) return setToast({ kind: 'error', msg: 'กรุณาเลือกรถ' })
    if (activeRoundForVehicle) return setToast({ kind: 'error', msg: `รถคันนี้มีรอบน้ำมันเปิดอยู่แล้ว: ${activeRoundForVehicle.code}` })
    if (!mileage || isNaN(Number(mileage))) return setToast({ kind: 'error', msg: 'เลขไมล์ไม่ถูกต้อง' })
    if (!Number(liters)) return setToast({ kind: 'error', msg: 'กรุณากรอกปริมาณเติม' })
    if (!Number(pricePerL)) return setToast({ kind: 'error', msg: 'กรุณากรอกราคา/ลิตร' })
    const cap = Number(tankCapacity) || DEFAULT_TANK_CAPACITY
    if (Number(liters) > cap) return setToast({ kind: 'error', msg: `ปริมาณเติมเกินความจุถัง (${cap} L)` })

    const startRefill: FuelRefill = {
      id: uid('rf'),
      type: 'start',
      mileage: Number(mileage),
      liters: Number(liters),
      pricePerL: Number(pricePerL),
      cost: totalCost,
      location: HOME_BASE,
      at: startAt,
    }
    const round = db.add<Partial<FuelRound>>('fuelRounds', {
      code: db.nextFuelRoundCode(),
      vehicleId,
      dispatchRoundId: linkDispatchId || null,
      tankCapacity: cap,
      status: 'open',
      refills: [startRefill],
      notes,
    })
    setTick(t => t + 1)
    setToast({ kind: 'success', msg: `✅ เปิดรอบ ${round.code} เรียบร้อย` })
    setTimeout(() => {
      setSubject({ type: 'fuelRound', id: round.id })
      setActive('fuel.round.refill')
    }, 800)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">เปิดรอบน้ำมัน</h1>
          <div className="page-sub">เริ่มรอบน้ำมันใหม่ — เติมเต็มถังที่ฐาน</div>
        </div>
      </div>

      {openRounds.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="head"><h3>รอบน้ำมันที่กำลังเปิดอยู่ ({openRounds.length})</h3></div>
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>รหัสรอบ</th>
                  <th>รถ</th>
                  <th>เปิดเมื่อ</th>
                  <th className="num">ไมล์เริ่ม</th>
                  <th className="num">เติมแล้ว</th>
                  <th>Dispatch</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {openRounds.map(r => {
                  const v = vehicles.find(x => x.id === r.vehicleId)
                  const startR = r.refills.find(x => x.type === 'start')
                  const inters = r.refills.filter(x => x.type === 'intermediate')
                  const dsp = r.dispatchRoundId ? db.get<Dispatch>('dispatch', r.dispatchRoundId) : null
                  return (
                    <tr key={r.id}>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.code}</td>
                      <td className="mono">{v?.plate ?? '—'}</td>
                      <td className="num muted">{startR?.at ? db.thaiDate(startR.at) : '—'}</td>
                      <td className="num">{db.fmt(startR?.mileage)}</td>
                      <td className="num">
                        {db.fmt(db.fuelRoundIntermediateTotal(r))} L
                        {inters.length > 0 && <span className="muted" style={{ fontSize: 11 }}> ({inters.length} ครั้ง)</span>}
                      </td>
                      <td>{dsp ? <span className="mono" style={{ fontSize: 11.5, color: 'var(--primary)' }}>{dsp.code}</span> : <span className="muted">—</span>}</td>
                      <td>
                        <div className="row btn-row">
                          <button
                            className="btn sm"
                            onClick={() => {
                              setSubject({ type: 'fuelRound', id: r.id })
                              setActive('fuel.round.refill')
                            }}
                          >
                            <Icon name="plus" size={13} /> เติมเพิ่ม
                          </button>
                          <button
                            className="btn primary sm"
                            onClick={() => {
                              setSubject({ type: 'fuelRound', id: r.id })
                              setActive('fuel.round.close')
                            }}
                          >
                            <Icon name="check" size={13} /> ปิด
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}><Icon name="fuel" size={20} /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>เริ่มรอบน้ำมันใหม่</h3>
          </div>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลือกรถ *">
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                <option value="">-- เลือก --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} ({v.brand} · {v.type})</option>
                ))}
              </select>
            </Field>
            <Field label="ที่อยู่เติมเริ่มต้น">
              <input value={HOME_BASE} disabled style={{ background: 'var(--bg)' }} />
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลขไมล์ตอนเติม (km) *">
              <input
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                placeholder="กรอกไมล์"
              />
            </Field>
            <Field label="วันที่/เวลาเติม *">
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
            </Field>
          </div>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ความจุถัง (L)">
              <input
                type="number"
                value={tankCapacity}
                onChange={e => setTankCapacity(e.target.value)}
              />
            </Field>
            <Field label="ปริมาณเติมเต็มถัง (L) *">
              <input
                type="number"
                value={liters}
                onChange={e => setLiters(e.target.value)}
              />
            </Field>
            <Field label="ราคา/ลิตร (฿) *">
              <input
                type="number"
                step="0.01"
                value={pricePerL}
                onChange={e => setPricePerL(e.target.value)}
              />
            </Field>
          </div>
          {draftDispatches.length > 0 && (
            <Field label="เชื่อมกับงานขนส่ง (Dispatch Round)">
              <select value={linkDispatchId} onChange={e => setLinkDispatchId(e.target.value)}>
                <option value="">— ไม่เชื่อม —</option>
                {draftDispatches.map(d => (
                  <option key={d.id} value={d.id}>{d.code}</option>
                ))}
              </select>
            </Field>
          )}
          <div style={{ marginTop: 8 }}>
            <Field label="หมายเหตุ">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional"
                style={{ resize: 'vertical', minHeight: 50 }}
              />
            </Field>
          </div>

          <div
            style={{
              marginTop: 14, padding: 10, background: '#ECFDF5',
              border: '1px solid #10B981', borderRadius: 6, fontSize: 13,
            }}
          >
            <span className="muted" style={{ fontSize: 11 }}>ต้นทุนเริ่มต้น (คิดในรอบก่อน): </span>
            <span className="mono" style={{ fontWeight: 600, color: '#10B981' }}>฿{db.fmt(totalCost)}</span>
          </div>

          <div className="row btn-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setActive('fuel')}>
              <Icon name="close" size={15} /> ยกเลิก
            </button>
            <button className="btn primary" onClick={submit}>
              <Icon name="check" size={15} /> เปิดรอบน้ำมัน
            </button>
          </div>
        </div>

        <div className="card">
          <div className="head"><h3>สถานะรถ</h3></div>
          {vehicle ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>ทะเบียน</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{vehicle.plate}</div>
                <div className="muted" style={{ fontSize: 12 }}>{vehicle.brand} · {vehicle.type}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>สถานะ</div>
                <div style={{ marginTop: 4 }}><StatusBadge status={vehicle.status} /></div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>รอบน้ำมันล่าสุด</div>
                {lastClosed ? (
                  <div>
                    <span className="mono" style={{ color: 'var(--primary)', fontSize: 13 }}>{lastClosed.code}</span>
                    <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>✓ CLOSED</span>
                  </div>
                ) : <span className="muted" style={{ fontSize: 12 }}>— ยังไม่มี —</span>}
              </div>
              {activeRoundForVehicle && (
                <div
                  style={{ padding: 10, background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 6, fontSize: 12.5 }}
                >
                  ⚠️ รถคันนี้มีรอบเปิดอยู่: <span className="mono" style={{ fontWeight: 600 }}>{activeRoundForVehicle.code}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              เลือกรถเพื่อดูข้อมูล
            </div>
          )}
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
