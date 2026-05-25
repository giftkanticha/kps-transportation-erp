import { useState, useEffect } from 'react'
import { db, uid } from '../../lib/db'
import { useList, useUpdate } from '../../hooks/useTable'
import type { Vehicle, FuelRound, FuelRefill } from '../../types'
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
          <h1 className="page-title">เติมน้ำมันปั้มนอก</h1>
          <div className="page-sub">เลือกรอบที่ต้องการเติม</div>
        </div>
      </div>
      <div className="card">
        <div className="head"><h3>รอบที่กำลังเปิดอยู่ ({rounds.length})</h3></div>
        {rounds.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>
            ไม่มีรอบที่เปิดอยู่ —{' '}
            <a onClick={() => location.hash = ''} style={{ cursor: 'pointer', color: 'var(--primary)' }}>เปิดรอบใหม่</a>
          </div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>รหัสรอบ</th>
                  <th>รถ</th>
                  <th>เปิดเมื่อ</th>
                  <th className="num">ไมล์เริ่ม</th>
                  <th className="num">เติมแล้ว</th>
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
                          เติม →
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

export function FuelRoundRefill({ setActive, setSubject, subject }: Props) {
  const subj = subject as { type?: string; id?: string } | null
  if (!subj?.id) return <OpenRoundsPicker setSubject={setSubject} />
  return <RefillForm roundId={subj.id} setActive={setActive} setSubject={setSubject} />
}

function RefillForm({
  roundId,
  setActive,
  setSubject,
}: { roundId: string; setActive: (id: string) => void; setSubject: (s: unknown) => void }) {
  const { data: allRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const updateRound = useUpdate<FuelRound>('fuel_rounds')
  const round = allRounds.find(r => r.id === roundId)
  const vehicle = round ? vehicles.find(v => v.id === round.vehicleId) : undefined

  const [location, setLocation] = useState('')
  const [mileage, setMileage] = useState('')
  const [requestedL, setRequestedL] = useState('')
  const [pricePerL, setPricePerL] = useState('35')
  const [at, setAt] = useState(nowLocal())
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)

  // Default pricePerL from start refill
  useEffect(() => {
    if (!round) return
    const start = round.refills.find(r => r.type === 'start')
    if (start) setPricePerL(String(start.pricePerL))
  }, [roundId])

  if (!round) {
    return (
      <div className="empty">
        ไม่พบรอบน้ำมัน —{' '}
        <a onClick={() => { setSubject(null); setActive('fuel.round.refill') }} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
          กลับ
        </a>
      </div>
    )
  }

  if (round.status === 'closed') {
    return (
      <div className="empty">
        รอบนี้ปิดแล้ว ไม่สามารถเติมเพิ่มได้ —{' '}
        <a onClick={() => { setSubject(null); setActive('fuel.round.refill') }} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
          กลับ
        </a>
      </div>
    )
  }

  const cap = round.tankCapacity
  const startRefill = round.refills.find(r => r.type === 'start')
  const intermediates = round.refills.filter(r => r.type === 'intermediate')
  const reqL = Number(requestedL) || 0
  const overCapacity = reqL > cap
  const actualL = overCapacity ? cap : reqL
  const cost = actualL * (Number(pricePerL) || 0)

  const submit = async () => {
    if (!location.trim()) return setToast({ kind: 'error', msg: 'กรุณากรอกตำแหน่งเติม' })
    if (!mileage || isNaN(Number(mileage))) return setToast({ kind: 'error', msg: 'เลขไมล์ไม่ถูกต้อง' })
    if (startRefill && Number(mileage) < startRefill.mileage) {
      return setToast({ kind: 'error', msg: 'เลขไมล์ต้องมากกว่าหรือเท่ากับไมล์เริ่ม' })
    }
    if (!actualL || actualL <= 0) return setToast({ kind: 'error', msg: 'กรุณากรอกปริมาณ' })
    if (!Number(pricePerL)) return setToast({ kind: 'error', msg: 'กรุณากรอกราคา/ลิตร' })
    if (startRefill && at < startRefill.at) return setToast({ kind: 'error', msg: 'เวลาต้องหลังเวลาเปิดรอบ' })

    const refill: FuelRefill = {
      id: uid('rf'),
      type: 'intermediate',
      mileage: Number(mileage),
      liters: actualL,
      pricePerL: Number(pricePerL),
      cost,
      location: location.trim(),
      at,
      notes: notes.trim() || undefined,
    }
    try {
      await updateRound.mutateAsync({
        id: round.id,
        patch: { refills: [...round.refills, refill] },
      })
      setToast({ kind: 'success', msg: `✅ บันทึกการเติม ${actualL.toFixed(0)} L เรียบร้อย` })
      // Reset form
      setLocation(''); setMileage(''); setRequestedL(''); setNotes('')
      setAt(nowLocal())
    } catch (e) {
      setToast({ kind: 'error', msg: '❌ บันทึกไม่สำเร็จ: ' + (e as Error).message })
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div
            className="row"
            style={{ gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            onClick={() => { setSubject(null); setActive('fuel.round.refill') }}
          >
            <span>← รอบที่เปิดอยู่</span>
          </div>
          <h1 className="page-title">
            เติมน้ำมันปั้มนอก · <span className="mono" style={{ color: 'var(--primary)' }}>{round.code}</span>
          </h1>
          <div className="page-sub">
            {vehicle?.plate ?? '—'} ({vehicle?.brand ?? '—'})
            {' • '}เปิดเมื่อ {startRefill?.at ? db.thaiDate(startRefill.at) : '—'}
            {' • '}ไมล์เริ่ม {db.fmt(startRefill?.mileage)} km
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: '12px 18px', borderRadius: 8,
          background: '#EFF6FF', border: '1px solid #0066CC',
          marginBottom: 16, fontSize: 13,
        }}
      >
        🛢️ ความจุถัง: <strong>{cap} L</strong>
        {' · '}เติมไปแล้วในรอบนี้: <strong>{db.fmt(db.fuelRoundIntermediateTotal(round))} L</strong>
        {' · '}จำนวนครั้งที่เติมปั้มนอก: <strong>{intermediates.length}</strong>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        {/* Form */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}><Icon name="fuel" size={20} /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลการเติม</h3>
          </div>

          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ตำแหน่งเติม *">
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="เช่น ปั้ม ปตท. ฉะเชิงเทรา" />
            </Field>
            <Field label="เลขไมล์ตอนเติม (km) *">
              <input
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                placeholder={startRefill ? `≥ ${startRefill.mileage}` : ''}
              />
            </Field>
          </div>

          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ปริมาณที่ต้องการเติม (L) *">
              <input
                type="number"
                value={requestedL}
                onChange={e => setRequestedL(e.target.value)}
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

          {overCapacity && (
            <div
              style={{
                padding: '12px 16px', marginBottom: 14,
                background: '#FEE2E2', border: '2px solid #EF4444', borderRadius: 6, fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ เกินความจุถัง</div>
              <div>ต้องการ: {reqL} L | ความจุถัง: {cap} L</div>
              <div style={{ color: '#10B981', marginTop: 4 }}>
                ✓ จะบันทึกเท่ากับความจุถัง: <strong>{cap} L</strong>
              </div>
            </div>
          )}

          <Field label="เวลาเติม *">
            <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} />
          </Field>
          <div style={{ marginTop: 14 }}>
            <Field label="หมายเหตุ">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ resize: 'vertical', minHeight: 50 }} />
            </Field>
          </div>

          <div
            style={{
              marginTop: 14, padding: 10, background: '#ECFDF5',
              border: '1px solid #10B981', borderRadius: 6, fontSize: 13,
            }}
          >
            <span className="muted" style={{ fontSize: 11 }}>ต้นทุนการเติม: </span>
            <span className="mono" style={{ fontWeight: 600, color: '#10B981' }}>
              ฿{db.fmt(cost)} ({actualL.toFixed(0)} L × ฿{Number(pricePerL).toFixed(2)})
            </span>
          </div>

          <div className="row btn-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => { setSubject(null); setActive('fuel.round.refill') }}>
              <Icon name="close" size={15} /> ยกเลิก
            </button>
            <button className="btn primary" onClick={submit}>
              <Icon name="check" size={15} /> บันทึกการเติม
            </button>
          </div>
        </div>

        {/* Right column: refill log */}
        <div className="card">
          <div className="head"><h3>บันทึกการเติม (รอบนี้)</h3></div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {startRefill && (
              <div style={{ padding: 10, borderRadius: 6, background: 'var(--bg)', fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>
                  ✓ START FULL {' '}<span className="muted" style={{ fontWeight: 400 }}>({startRefill.at.slice(11, 16)})</span>
                </div>
                <div className="muted" style={{ marginTop: 2 }}>
                  {startRefill.liters} L @ {startRefill.location}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>
                  ฿{db.fmt(startRefill.cost)} (คิดในรอบก่อน)
                </div>
              </div>
            )}
            {intermediates.map((r, i) => (
              <div key={r.id} style={{ padding: 10, borderRadius: 6, background: '#EFF6FF', fontSize: 12, border: '1px solid #BFDBFE' }}>
                <div style={{ fontWeight: 600 }}>
                  ➕ INTERMEDIATE #{i + 1}{' '}<span className="muted" style={{ fontWeight: 400 }}>({r.at.slice(11, 16)})</span>
                </div>
                <div className="muted" style={{ marginTop: 2 }}>
                  {r.liters} L @ {r.location}
                </div>
                <div style={{ color: '#10B981', fontSize: 11, fontWeight: 600 }}>
                  + ฿{db.fmt(r.cost)}
                </div>
              </div>
            ))}
            {intermediates.length === 0 && (
              <div className="muted" style={{ textAlign: 'center', fontSize: 12, padding: 8 }}>
                ยังไม่มีการเติมระหว่างทาง
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
