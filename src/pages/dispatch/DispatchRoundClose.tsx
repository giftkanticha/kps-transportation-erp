import { useState, useMemo, useEffect } from 'react'
import { db, uid, DSP_KMPL_THRESHOLD } from '../../lib/db'
import type { Vehicle, Employee, Dispatch, DispatchLeg, OtherExpense } from '../../types'
import { Icon, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
  subject: unknown
}

interface ToastState { kind: 'success' | 'error'; msg: string }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [toast, onClose])
  const ok = toast.kind === 'success'
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 100, right: 24, zIndex: 1200,
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

interface LegCloseState {
  id: string
  deliveredWeight: string
  perDiem: string
  notes: string
}

function legTypeLabel(t?: string): string {
  if (t === 'backhaul') return 'Backhaul'
  if (t === 'return') return 'Return'
  return 'Outbound'
}

function DraftRoundsList({
  setSubject,
}: { setSubject: (s: unknown) => void }) {
  const vehicles = db.getAll<Vehicle>('vehicles')
  const employees = db.getAll<Employee>('employees')
  const drafts = db.getAll<Dispatch>('dispatch').filter(d => d.roundStatus === 'draft')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ปิดงานขนส่ง</h1>
          <div className="page-sub">เลือกรอบที่ต้องการปิด</div>
        </div>
      </div>
      <div className="card">
        <div className="head"><h3>รอบงานค้าง (DRAFT) — {drafts.length} รอบ</h3></div>
        {drafts.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>ไม่มีรอบงานค้าง</div>
        ) : (
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>รหัสรอบ</th>
                  <th>ทะเบียน</th>
                  <th>คนขับ</th>
                  <th>ออกเดินทาง</th>
                  <th className="num">จำนวนขา</th>
                  <th className="num right">รายได้</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drafts.map(d => {
                  const v = vehicles.find(x => x.id === d.vehicleId)
                  const dr = employees.find(x => x.id === d.driverId)
                  return (
                    <tr
                      key={d.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSubject({ type: 'round', id: d.id })}
                    >
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{d.code}</td>
                      <td className="mono">{v?.plate ?? '—'}</td>
                      <td>{dr?.name ?? '—'}</td>
                      <td className="num muted">{db.thaiDate(d.depart || d.date)}</td>
                      <td className="num">{d.legs?.length ?? 0}</td>
                      <td className="num right">{db.thb(db.roundRevenue(d))}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn primary sm" onClick={() => setSubject({ type: 'round', id: d.id })}>
                          ปิดงาน →
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

export function DispatchRoundClose({ setActive, setSubject, subject }: Props) {
  const subj = subject as { type?: string; id?: string } | null

  if (!subj?.id) {
    return <DraftRoundsList setSubject={setSubject} />
  }

  return <CloseForm roundId={subj.id} setActive={setActive} setSubject={setSubject} />
}

function CloseForm({
  roundId,
  setActive,
  setSubject,
}: { roundId: string; setActive: (id: string) => void; setSubject: (s: unknown) => void }) {
  const [tick, setTick] = useState(0)
  const round = useMemo(() => db.get<Dispatch>('dispatch', roundId), [roundId, tick])
  const vehicle = round ? db.get<Vehicle>('vehicles', round.vehicleId ?? '') : undefined
  const driver = round ? db.get<Employee>('employees', round.driverId ?? '') : undefined

  const legs = round?.legs ?? []
  const [legStates, setLegStates] = useState<LegCloseState[]>([])
  const [endMileage, setEndMileage] = useState('')
  const [returnAt, setReturnAt] = useState('')
  const [otherExp, setOtherExp] = useState<OtherExpense[]>([])
  const [roundNotes, setRoundNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Initialize form from round
  useEffect(() => {
    if (!round) return
    setLegStates(
      (round.legs ?? []).map(l => ({
        id: l.id || uid('lg'),
        deliveredWeight: l.deliveredWeight != null ? String(l.deliveredWeight) : '',
        perDiem: l.perDiem != null ? String(l.perDiem) : '',
        notes: l.notes || '',
      })),
    )
    setEndMileage(round.endOdometer != null ? String(round.endOdometer) : '')
    setReturnAt(round.returnAt || nowLocal())
    setOtherExp(round.otherExpenses ?? [])
    setRoundNotes(round.notes || '')
  }, [roundId])

  if (!round) {
    return (
      <div className="empty">
        ไม่พบรอบงาน —{' '}
        <a onClick={() => { setSubject(null); setActive('dispatch.close') }} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
          กลับ
        </a>
      </div>
    )
  }

  const isClosed = round.roundStatus === 'closed'

  const updateLegState = (i: number, patch: Partial<LegCloseState>) => {
    setLegStates(s => s.map((ls, ix) => (ix === i ? { ...ls, ...patch } : ls)))
  }

  const addExpense = () => setOtherExp(es => [...es, { id: uid('ex'), label: '', amount: 0 }])
  const removeExpense = (id: string) => setOtherExp(es => es.filter(e => e.id !== id))
  const updateExpense = (id: string, patch: Partial<OtherExpense>) =>
    setOtherExp(es => es.map(e => (e.id === id ? { ...e, ...patch } : e)))

  // Summary calc (live)
  const revenue = legs.reduce((s, l) => s + (l.amount || 0), 0)
  const perDiemTotal = legStates.reduce((s, ls) => s + (Number(ls.perDiem) || 0), 0)
  const otherTotal = otherExp.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const distance = endMileage && round.startOdometer != null
    ? Math.max(0, Number(endMileage) - round.startOdometer)
    : 0
  // For fuel cost: Phase 1 has no FuelRound, so derive from legacy field
  const fuelCost = round.cost || 0
  const profit = revenue - fuelCost - perDiemTotal - otherTotal
  const kmPerL = round.liters && distance ? distance / round.liters : null
  const isKmlLow = kmPerL != null && kmPerL < DSP_KMPL_THRESHOLD

  const buildLegsPatch = (markClosed: boolean): DispatchLeg[] =>
    legs.map((l, i) => {
      const ls = legStates[i]
      const dw = ls?.deliveredWeight ? Number(ls.deliveredWeight) : null
      const pd = ls?.perDiem ? Number(ls.perDiem) : 0
      return {
        ...l,
        deliveredWeight: dw,
        perDiem: pd,
        notes: ls?.notes || l.notes,
        closed: markClosed && (l.legType === 'return' || dw != null),
      }
    })

  const validateClose = (legsToCheck: DispatchLeg[]): string | null => {
    if (!endMileage) return 'กรุณากรอกเลขไมล์ปลายรอบ'
    const em = Number(endMileage)
    if (isNaN(em)) return 'เลขไมล์ไม่ถูกต้อง'
    if (round.startOdometer != null && em <= round.startOdometer)
      return 'เลขไมล์ปลายต้องมากกว่าต้นรอบ'
    if (!returnAt) return 'กรุณาระบุเวลาถึงฐาน'
    for (let i = 0; i < legsToCheck.length; i++) {
      const l = legsToCheck[i]
      if (l.legType === 'return') continue
      if (l.deliveredWeight == null || isNaN(l.deliveredWeight))
        return `ขา ${i + 1}: กรุณากรอกน้ำหนักปลายทาง`
      if (l.deliveredWeight > (l.weight || 0))
        return `ขา ${i + 1}: น้ำหนักปลาย (${l.deliveredWeight}) เกินน้ำหนักโหลด (${l.weight})`
    }
    return null
  }

  const submit = (mode: 'draft' | 'close') => {
    if (saving) return
    setSaving(true)
    try {
      const newLegs = buildLegsPatch(mode === 'close')
      if (mode === 'close') {
        const err = validateClose(newLegs)
        if (err) throw new Error(err)
      }
      const em = endMileage ? Number(endMileage) : null
      const dist = em != null && round.startOdometer != null ? Math.max(0, em - round.startOdometer) : null
      db.update<Dispatch>('dispatch', round.id, {
        legs: newLegs,
        endOdometer: em,
        distance: dist,
        returnAt,
        otherExpenses: otherExp.filter(e => e.label.trim() && (e.amount || 0) !== 0),
        notes: roundNotes,
        perDiem: perDiemTotal,
        revenue,
        totalAmount: revenue,
        kmPerL: round.liters && dist ? dist / round.liters : null,
        roundStatus: mode === 'close' ? 'closed' : 'draft',
        status: mode === 'close' ? 'completed' : round.status,
        progress: mode === 'close' ? 100 : round.progress,
      })
      setTick(t => t + 1)
      if (mode === 'close') {
        setToast({ kind: 'success', msg: `✅ ปิดรอบ ${round.code} เรียบร้อย` })
        setTimeout(() => {
          setSubject(null)
          setActive('dispatch.open')
        }, 1200)
      } else {
        setToast({ kind: 'success', msg: '✅ บันทึกร่างเรียบร้อย' })
        setSaving(false)
      }
    } catch (err) {
      setToast({ kind: 'error', msg: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ' })
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div
            className="row"
            style={{ gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            onClick={() => { setSubject(null); setActive('dispatch.close') }}
          >
            <span>← รอบงานค้าง</span>
          </div>
          <h1 className="page-title">
            ปิดงานขนส่ง · <span className="mono" style={{ color: 'var(--primary)' }}>{round.code}</span>
            {isClosed && <span className="badge green" style={{ marginLeft: 12, fontSize: 11 }}>CLOSED</span>}
          </h1>
          <div className="page-sub">
            {vehicle?.plate ?? '—'} ({vehicle?.brand ?? '—'}) • คนขับ {driver?.name ?? '—'} • ออก {db.thaiDate(round.depart || round.date)}
          </div>
        </div>
      </div>

      {/* Round info read-only */}
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="grid-4" style={{ gap: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>รหัสรอบ</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{round.code}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>เลขไมล์ต้นรอบ</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.fmt(round.startOdometer)} km</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>จำนวนขา</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{legs.length} ขา</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>รายได้ค่าขนส่ง</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>{db.thb(revenue)}</div>
          </div>
        </div>
      </div>

      {/* Per-leg close form */}
      <h3 className="section-title" style={{ marginBottom: 10 }}>บันทึกข้อมูลปลายทางทุกขา</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
        {legs.map((l, i) => {
          const ls = legStates[i]
          if (!ls) return null
          const dw = Number(ls.deliveredWeight) || 0
          const diff = (l.weight || 0) - dw
          const filled = ls.deliveredWeight !== ''
          const isReturn = l.legType === 'return'
          return (
            <div key={l.id || i} className="card pad">
              <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    ขา {i + 1} — {l.origin} → {l.destination}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {l.customerId ? db.nameOf('customers', l.customerId) : '—'}
                    {' • '}{l.cargoType || '—'}
                    {' • '}<span className="badge" style={{ fontSize: 10.5 }}>{legTypeLabel(l.legType)}</span>
                  </div>
                </div>
                <div>
                  {isReturn
                    ? <span className="badge" style={{ fontSize: 11 }}>เที่ยวเปล่า</span>
                    : (filled
                      ? <span className="badge green" style={{ fontSize: 11 }}>✓ กรอกแล้ว</span>
                      : <span className="badge amber" style={{ fontSize: 11 }}>○ ยังไม่กรอก</span>
                    )}
                </div>
              </div>
              <div className="grid-3" style={{ gap: 12 }}>
                <Field label="น้ำหนักต้นทาง (ตัน)">
                  <input type="number" value={l.weight || 0} disabled style={{ background: 'var(--bg)' }} />
                </Field>
                {!isReturn && (
                  <Field label="น้ำหนักปลายทาง (ตัน) *">
                    <input
                      type="number"
                      step="0.01"
                      value={ls.deliveredWeight}
                      onChange={e => updateLegState(i, { deliveredWeight: e.target.value })}
                      placeholder="0.00"
                      disabled={isClosed}
                    />
                  </Field>
                )}
                <Field label="เบี้ยเลี้ยง (฿)">
                  <input
                    type="number"
                    value={ls.perDiem}
                    onChange={e => updateLegState(i, { perDiem: e.target.value })}
                    placeholder="0"
                    disabled={isClosed}
                  />
                </Field>
              </div>
              {!isReturn && filled && (
                <div style={{ marginTop: 10, fontSize: 12 }}>
                  {diff <= 0.001
                    ? <span style={{ color: 'var(--green)' }}>✓ ส่งครบ {(l.weight || 0).toFixed(2)} ตัน</span>
                    : <span style={{ color: 'var(--amber)' }}>⚠️ ขาดส่ง {diff.toFixed(2)} ตัน</span>
                  }
                  {dw > (l.weight || 0) && (
                    <span style={{ color: 'var(--red)', marginLeft: 12 }}>❌ น้ำหนักปลายเกินต้น</span>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <Field label="หมายเหตุขา">
                  <input
                    value={ls.notes}
                    onChange={e => updateLegState(i, { notes: e.target.value })}
                    placeholder="Optional"
                    disabled={isClosed}
                  />
                </Field>
              </div>
            </div>
          )
        })}
        {legs.length === 0 && (
          <div className="card pad empty">
            ยังไม่มีขา —{' '}
            <a
              onClick={() => { setSubject({ type: 'round', id: round.id }); setActive('dispatch.round') }}
              style={{ cursor: 'pointer', color: 'var(--primary)' }}
            >
              กลับไปเพิ่มขา
            </a>
          </div>
        )}
      </div>

      {/* End of round info */}
      <h3 className="section-title" style={{ marginBottom: 10 }}>ข้อมูลสิ้นสุดรอบ</h3>
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
          <Field label="เลขไมล์ปลายรอบ (km) *">
            <input
              type="number"
              value={endMileage}
              onChange={e => setEndMileage(e.target.value)}
              placeholder="เช่น 248410"
              disabled={isClosed}
            />
            {distance > 0 && (
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                ระยะทาง: {db.fmt(distance)} km
              </div>
            )}
          </Field>
          <Field label="เวลาถึงฐาน *">
            <input
              type="datetime-local"
              value={returnAt}
              onChange={e => setReturnAt(e.target.value)}
              disabled={isClosed}
            />
          </Field>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>ค่าใช้จ่ายอื่นๆ</span>
            {!isClosed && (
              <button className="btn sm" onClick={addExpense}>
                <Icon name="plus" size={13} /> เพิ่มรายการ
              </button>
            )}
          </div>
          {otherExp.length === 0 ? (
            <div className="muted" style={{ fontSize: 12, padding: '6px 0' }}>— ไม่มีค่าใช้จ่ายอื่น —</div>
          ) : (
            <table className="tbl" style={{ marginBottom: 6 }}>
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th className="num" style={{ width: 140 }}>จำนวน (฿)</th>
                  {!isClosed && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {otherExp.map(e => (
                  <tr key={e.id}>
                    <td>
                      <input
                        value={e.label}
                        onChange={ev => updateExpense(e.id, { label: ev.target.value })}
                        placeholder="เช่น ค่าทางด่วน"
                        disabled={isClosed}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={e.amount || ''}
                        onChange={ev => updateExpense(e.id, { amount: Number(ev.target.value) || 0 })}
                        disabled={isClosed}
                      />
                    </td>
                    {!isClosed && (
                      <td>
                        <button className="btn ghost icon sm" onClick={() => removeExpense(e.id)} style={{ color: 'var(--red)' }}>
                          <Icon name="close" size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Field label="หมายเหตุรอบ">
          <textarea
            value={roundNotes}
            onChange={e => setRoundNotes(e.target.value)}
            rows={2}
            disabled={isClosed}
            style={{ resize: 'vertical', minHeight: 56 }}
          />
        </Field>
      </div>

      {/* Sticky summary footer */}
      <div
        style={{
          position: 'sticky', bottom: 0, zIndex: 50,
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 10, padding: '14px 20px',
          boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
          marginTop: 8,
        }}
      >
        <div className="row" style={{ gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div className="muted" style={{ fontSize: 10.5 }}>รายได้</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>{db.thb(revenue)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 10.5 }}>ค่าน้ำมัน</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.thb(fuelCost)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 10.5 }}>เบี้ยเลี้ยง</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.thb(perDiemTotal)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 10.5 }}>อื่นๆ</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.thb(otherTotal)}</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 24 }}>
            <div className="muted" style={{ fontSize: 10.5 }}>กำไรสุทธิ</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {db.thb(profit)}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 10.5 }}>ระยะทาง</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{db.fmt(distance)} km</div>
          </div>
          {kmPerL != null && (
            <div>
              <div className="muted" style={{ fontSize: 10.5 }}>KM/L</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: isKmlLow ? 'var(--red)' : 'var(--text-1)' }}>
                {kmPerL.toFixed(2)} {isKmlLow && '⚠️'}
              </div>
            </div>
          )}
          <div className="spacer" />
          {!isClosed && (
            <div className="btn-row">
              <button className="btn" onClick={() => submit('draft')} disabled={saving}>
                <Icon name="check" size={15} /> บันทึกร่าง
              </button>
              <button className="btn primary" onClick={() => submit('close')} disabled={saving}>
                <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'ปิดงานขนส่ง'}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
