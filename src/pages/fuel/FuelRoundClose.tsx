import { useState, useEffect } from 'react'
import { db, uid, HOME_BASE, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList, useUpdate } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import type { Vehicle, FuelRound, FuelRefill, Dispatch } from '../../types'
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

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function OpenRoundsPicker({ setSubject }: { setSubject: (s: unknown) => void }) {
  const { data: allRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const rounds = allRounds.filter(r => r.status === 'open')
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ปิดรอบน้ำมัน</h1>
          <div className="page-sub">เลือกรอบที่ต้องการปิด</div>
        </div>
      </div>
      <div className="card">
        <div className="head"><h3>รอบที่กำลังเปิดอยู่ ({rounds.length})</h3></div>
        {rounds.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>ไม่มีรอบที่เปิดอยู่</div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>รหัสรอบ</th>
                  <th>รถ</th>
                  <th>เปิดเมื่อ</th>
                  <th className="num">ไมล์เริ่ม</th>
                  <th className="num">เติมระหว่างทาง</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rounds.map(r => {
                  const v = vehicles.find(x => x.id === r.vehicleId)
                  const start = r.refills.find(x => x.type === 'start')
                  return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSubject({ type: 'fuelRound', id: r.id })}>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.code}</td>
                      <td className="mono">{v?.plate ?? '—'}</td>
                      <td className="num muted">{start?.at ? db.thaiDate(start.at) : '—'}</td>
                      <td className="num">{db.fmt(start?.mileage)}</td>
                      <td className="num">{db.fmt(db.fuelRoundIntermediateTotal(r))} L</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn primary sm" onClick={() => setSubject({ type: 'fuelRound', id: r.id })}>
                          ปิด →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function FuelRoundClose({ setActive, setSubject, subject }: Props) {
  const subj = subject as { type?: string; id?: string } | null
  if (!subj?.id) return <OpenRoundsPicker setSubject={setSubject} />
  return <CloseForm roundId={subj.id} setActive={setActive} setSubject={setSubject} />
}

function CloseForm({
  roundId,
  setActive,
  setSubject,
}: { roundId: string; setActive: (id: string) => void; setSubject: (s: unknown) => void }) {
  const { data: allRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: dispatches = [] } = useDispatches()
  const updateRound = useUpdate<FuelRound>('fuel_rounds', {
    activity: r => `ปิดรอบน้ำมัน ${r.code} (${vehicles.find(v => v.id === r.vehicleId)?.plate ?? '—'})`,
  })
  const updateDispatch = useUpdate<Dispatch>('dispatch')
  const round = allRounds.find(r => r.id === roundId)
  const vehicle = round ? vehicles.find(v => v.id === round.vehicleId) : undefined
  const linkedDispatch = round?.dispatchRoundId
    ? dispatches.find(d => d.id === round.dispatchRoundId) ?? null
    : null

  const [endMileage, setEndMileage] = useState('')
  const [endLiters, setEndLiters] = useState('')
  const [pricePerL, setPricePerL] = useState('35')
  const [endAt, setEndAt] = useState(nowLocal())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!round) return
    const start = round.refills.find(r => r.type === 'start')
    if (start) setPricePerL(String(start.pricePerL))
  }, [roundId])

  if (!round) {
    return (
      <div className="empty">
        ไม่พบรอบน้ำมัน —{' '}
        <a onClick={() => { setSubject(null); setActive('fuel.round.close') }} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
          กลับ
        </a>
      </div>
    )
  }

  if (round.status === 'closed') {
    return (
      <div className="empty">
        รอบนี้ปิดแล้ว —{' '}
        <a onClick={() => { setSubject(null); setActive('fuel.round.close') }} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
          กลับ
        </a>
      </div>
    )
  }

  const startR = round.refills.find(r => r.type === 'start')
  const startLiters = startR?.liters ?? 0
  const startMileage = startR?.mileage ?? 0
  const intermediateTotal = db.fuelRoundIntermediateTotal(round)

  const em = Number(endMileage) || 0
  const el = Number(endLiters) || 0
  const distance = em > startMileage ? em - startMileage : 0
  // Consumed = intermediates + end-fill (tank starts and ends at full)
  const consumed = intermediateTotal + el
  const efficiency = consumed > 0 && distance > 0 ? distance / consumed : null
  const isLow = efficiency != null && efficiency < DSP_KMPL_THRESHOLD
  const endCost = el * (Number(pricePerL) || 0)
  const intermediateCost = round.refills
    .filter(r => r.type === 'intermediate')
    .reduce((s, r) => s + r.cost, 0)
  const totalFuelCost = intermediateCost + endCost

  const submit = async () => {
    if (saving) return
    if (!endMileage || isNaN(em)) return setToast({ kind: 'error', msg: 'เลขไมล์ไม่ถูกต้อง' })
    if (em <= startMileage) return setToast({ kind: 'error', msg: 'เลขไมล์ปลายต้องมากกว่าไมล์เริ่ม' })
    if (!endLiters || el <= 0) return setToast({ kind: 'error', msg: 'กรุณากรอกปริมาณเติมตอนปิด' })
    if (el > round.tankCapacity) return setToast({ kind: 'error', msg: `เกินความจุถัง (${round.tankCapacity} L)` })
    if (!Number(pricePerL)) return setToast({ kind: 'error', msg: 'กรุณากรอกราคา/ลิตร' })
    if (startR && endAt < startR.at) return setToast({ kind: 'error', msg: 'เวลาต้องหลังเวลาเปิดรอบ' })

    setSaving(true)
    let ok = false
    try {
      const endRefill: FuelRefill = {
        id: uid('rf'),
        type: 'end',
        mileage: em,
        liters: el,
        pricePerL: Number(pricePerL),
        cost: endCost,
        location: HOME_BASE,
        at: endAt,
        notes: notes.trim() || undefined,
      }
      await updateRound.mutateAsync({
        id: round.id,
        patch: { refills: [...round.refills, endRefill], status: 'closed' },
      })

      // If linked dispatch round exists, update its cost field with fuel cost
      if (linkedDispatch) {
        await updateDispatch.mutateAsync({
          id: linkedDispatch.id,
          patch: { cost: totalFuelCost, liters: consumed, kmPerL: efficiency },
        })
      }

      ok = true
      setToast({ kind: 'success', msg: `✅ ปิดรอบ ${round.code} เรียบร้อย` })
      setTimeout(() => {
        setSubject(null)
        setActive('fuel.round.close')
      }, 1200)
    } catch (err) {
      setToast({ kind: 'error', msg: err instanceof Error ? err.message : 'ปิดรอบไม่สำเร็จ' })
    } finally {
      // Reset on failure so the user can retry; on success the page navigates away
      // shortly anyway, but reset is harmless either way.
      if (!ok) setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div
            className="row"
            style={{ gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            onClick={() => { setSubject(null); setActive('fuel.round.close') }}
          >
            <span>← รอบที่เปิดอยู่</span>
          </div>
          <h1 className="page-title">
            ปิดรอบน้ำมัน · <span className="mono" style={{ color: 'var(--primary)' }}>{round.code}</span>
          </h1>
          <div className="page-sub">
            {vehicle?.plate ?? '—'} ({vehicle?.brand ?? '—'})
            {' • '}เปิด {startR?.at ? db.thaiDate(startR.at) : '—'}
            {' • '}ไมล์เริ่ม {db.fmt(startMileage)} km
            {linkedDispatch && <> {' • '}Dispatch: <span className="mono" style={{ color: 'var(--primary)' }}>{linkedDispatch.code}</span></>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        {/* Form */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}><Icon name="fuel" size={20} /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลตอนปิดรอบ</h3>
          </div>

          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลขไมล์สิ้นสุด (km) *">
              <input
                type="number"
                value={endMileage}
                onChange={e => setEndMileage(e.target.value)}
                placeholder={`> ${startMileage}`}
              />
              {distance > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  ระยะทาง: {db.fmt(startMileage)} → {db.fmt(em)} = <strong>{db.fmt(distance)} km</strong>
                </div>
              )}
            </Field>
            <Field label="เวลาเติมตอนปิด *">
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
            </Field>
          </div>

          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label={`ปริมาณเติมตอนปิด (เต็มถัง ${round.tankCapacity} L) *`}>
              <input
                type="number"
                step="0.01"
                value={endLiters}
                onChange={e => setEndLiters(e.target.value)}
                placeholder="0"
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

          <Field label="หมายเหตุ">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ resize: 'vertical', minHeight: 50 }} />
          </Field>

          <div
            style={{
              marginTop: 14, padding: 12, background: '#ECFDF5',
              border: '1px solid #10B981', borderRadius: 6, fontSize: 13,
            }}
          >
            <div className="muted" style={{ fontSize: 11 }}>ต้นทุนเติมตอนปิด</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}>
              ฿{db.fmt(endCost)}
            </div>
          </div>

          <div className="row btn-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => { setSubject(null); setActive('fuel.round.close') }} disabled={saving}>
              <Icon name="close" size={15} /> ยกเลิก
            </button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'ปิดรอบน้ำมัน'}
            </button>
          </div>
        </div>

        {/* Right: calculation + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="head"><h3>คำนวณน้ำมัน</h3></div>
            <div style={{ padding: 16, fontSize: 13 }}>
              <table style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                <tbody>
                  <tr><td>เปิดรอบ (FULL):</td><td className="num right">{startLiters} L</td></tr>
                  <tr><td>+ เติมระหว่างทาง:</td><td className="num right">{intermediateTotal} L</td></tr>
                  <tr><td>+ เติมตอนปิด:</td><td className="num right">{el} L</td></tr>
                  <tr style={{ borderTop: '1px dashed var(--line)' }}>
                    <td style={{ paddingTop: 6, fontWeight: 600 }}>🎯 ใช้จริง:</td>
                    <td className="num right" style={{ paddingTop: 6, fontWeight: 700, color: '#0066CC' }}>{consumed.toFixed(1)} L</td>
                  </tr>
                </tbody>
              </table>
              <div className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>
                สูตร: intermediates ({intermediateTotal}) + end-fill ({el}) = {consumed.toFixed(1)} L
              </div>
              {efficiency != null && (
                <div
                  style={{
                    marginTop: 14, padding: 10, borderRadius: 6,
                    background: isLow ? '#FEE2E2' : '#ECFDF5',
                    border: `1px solid ${isLow ? '#EF4444' : '#10B981'}`,
                  }}
                >
                  <div className="muted" style={{ fontSize: 11 }}>📊 Efficiency</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: isLow ? '#EF4444' : '#10B981' }}>
                    {efficiency.toFixed(2)} km/L
                    {isLow && ' ⚠️'}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {db.fmt(distance)} km ÷ {consumed.toFixed(1)} L
                    {isLow && ` (ต่ำกว่าเกณฑ์ ${DSP_KMPL_THRESHOLD})`}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="head"><h3>สรุปต้นทุนน้ำมัน</h3></div>
            <div style={{ padding: 16, fontSize: 12.5 }}>
              <table style={{ width: '100%', fontFamily: 'var(--font-mono)' }}>
                <tbody>
                  <tr><td>Intermediate:</td><td className="num right">฿{db.fmt(intermediateCost)}</td></tr>
                  <tr><td>End-fill:</td><td className="num right">฿{db.fmt(endCost)}</td></tr>
                  <tr style={{ borderTop: '1px dashed var(--line)' }}>
                    <td style={{ paddingTop: 6, fontWeight: 600 }}>รวมต้นทุน:</td>
                    <td className="num right" style={{ paddingTop: 6, fontWeight: 700, color: '#10B981' }}>฿{db.fmt(totalFuelCost)}</td>
                  </tr>
                </tbody>
              </table>
              {linkedDispatch && (
                <div className="muted" style={{ fontSize: 11, marginTop: 10, padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
                  💡 ต้นทุนนี้จะถูกบันทึกเข้า Dispatch <span className="mono">{linkedDispatch.code}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
