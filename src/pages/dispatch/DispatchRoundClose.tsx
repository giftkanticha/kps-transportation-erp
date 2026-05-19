import { useState, useMemo, useEffect } from 'react'
import { db, uid, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import type { Vehicle, Employee, Customer, Dispatch, DispatchLeg, OtherExpense, FuelTransaction } from '../../types'
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

const MAX_WEIGHT_LOSS_KG = 100

function legTypeLabel(t?: string): string {
  if (t === 'backhaul') return 'Backhaul'
  if (t === 'return') return 'Return'
  return 'Outbound'
}

function calcLegAmount(priceMode: DispatchLeg['priceMode'] | undefined, weightTon: number, price: number): number {
  if (priceMode === 'lump') return price
  if (priceMode === 'per_kg') return weightTon * 1000 * price
  return weightTon * price // per_ton (default)
}

function adjustedAmount(leg: DispatchLeg, deliveredWeightTon: number | null): number {
  // Lump: amount doesn't depend on delivered weight
  if (leg.priceMode === 'lump') return leg.price || leg.amount || 0
  // Return leg: no freight
  if (leg.legType === 'return') return 0
  // If deliveredWeight not provided, use original loaded weight
  const w = deliveredWeightTon != null ? deliveredWeightTon : (leg.weight || 0)
  return calcLegAmount(leg.priceMode, w, leg.price || 0)
}

// User-input unit for the deliveredWeight field follows the leg's priceMode.
function weightUnitForLeg(mode: DispatchLeg['priceMode'] | undefined): 'กก.' | 'ตัน' {
  return mode === 'per_kg' ? 'กก.' : 'ตัน'
}

// Convert deliveredWeight user-input (in matching unit) → canonical ตัน for storage/calc.
function dwInputToTon(input: string, mode: DispatchLeg['priceMode'] | undefined): number | null {
  if (input === '' || input == null) return null
  const n = Number(input)
  if (isNaN(n)) return null
  return mode === 'per_kg' ? n / 1000 : n
}

// Convert canonical ตัน → user-input unit for display when re-opening a leg.
function tonToDwInput(weightTon: number | null | undefined, mode: DispatchLeg['priceMode'] | undefined): string {
  if (weightTon == null) return ''
  return mode === 'per_kg' ? String(weightTon * 1000) : String(weightTon)
}

function DraftRoundsList({
  setSubject,
}: { setSubject: (s: unknown) => void }) {
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
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
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: customers = [] } = useList<Customer>('customers')
  const round = useMemo(() => db.get<Dispatch>('dispatch', roundId), [roundId, tick])
  const vehicle = round ? vehicles.find(v => v.id === (round.vehicleId ?? '')) : undefined
  const driver = round ? employees.find(e => e.id === (round.driverId ?? '')) : undefined

  const legs = round?.legs ?? []
  const [legStates, setLegStates] = useState<LegCloseState[]>([])
  const [endMileage, setEndMileage] = useState('')
  const [returnAt, setReturnAt] = useState('')
  const [otherExp, setOtherExp] = useState<OtherExpense[]>([])
  const [roundNotes, setRoundNotes] = useState('')
  const [closingFuelLiters, setClosingFuelLiters] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Fuel transactions linked to this round
  const linkedFuelTxs = useMemo(
    () => db.getAll<FuelTransaction>('fuelTransactions')
      .filter(t => t.tripId === roundId && t.status !== 'REVERSED'),
    [roundId, tick],
  )
  const fuelOpening = linkedFuelTxs.filter(t => t.tripFuelRole === 'TRIP_OPENING')
  const fuelIntermediate = linkedFuelTxs.filter(t => t.tripFuelRole === 'INTERMEDIATE')
  const fuelClosing = linkedFuelTxs.filter(t => t.tripFuelRole === 'TRIP_CLOSING')
  const fuelNormal = linkedFuelTxs.filter(t => t.tripFuelRole === 'NORMAL')
  const sumIntermediate = fuelIntermediate.reduce((s, t) => s + t.liters, 0)
  const sumNormal = fuelNormal.reduce((s, t) => s + t.liters, 0)

  // Initialize form from round
  useEffect(() => {
    if (!round) return
    setLegStates(
      (round.legs ?? []).map(l => ({
        id: l.id || uid('lg'),
        // legState.deliveredWeight is the USER-input value in the leg's display unit
        // (กก. for per_kg, ตัน otherwise). Convert from canonical ตัน at load.
        deliveredWeight: tonToDwInput(l.deliveredWeight ?? null, l.priceMode),
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

  // Live calc: revenue uses ADJUSTED amount based on deliveredWeight + priceMode.
  // legState.deliveredWeight is in user-unit (กก. for per_kg, ตัน otherwise) → convert to ตัน.
  const adjustedLegAmounts = legs.map((l, i) => {
    const ls = legStates[i]
    const dwTon = ls?.deliveredWeight ? dwInputToTon(ls.deliveredWeight, l.priceMode) : null
    return adjustedAmount(l, dwTon)
  })
  const revenue = adjustedLegAmounts.reduce((s, a) => s + a, 0)
  const perDiemTotal = legStates.reduce((s, ls) => s + (Number(ls.perDiem) || 0), 0)
  const otherTotal = otherExp.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const distance = endMileage && round.startOdometer != null
    ? Math.max(0, Number(endMileage) - round.startOdometer)
    : 0
  const fuelCost = round.cost || 0
  const profit = revenue - fuelCost - perDiemTotal - otherTotal

  // New KM/L calc: INTERMEDIATE + TRIP_CLOSING input (TRIP_OPENING excluded)
  const closingL = parseFloat(closingFuelLiters) || 0
  const totalFuelForKmpl = sumIntermediate + sumNormal + closingL
  const kmPerL = distance > 0 && totalFuelForKmpl > 0
    ? distance / totalFuelForKmpl
    : round.liters && distance ? distance / round.liters : null
  const isKmlLow = kmPerL != null && kmPerL < DSP_KMPL_THRESHOLD

  const buildLegsPatch = (markClosed: boolean): DispatchLeg[] =>
    legs.map((l, i) => {
      const ls = legStates[i]
      const dwTon = ls?.deliveredWeight ? dwInputToTon(ls.deliveredWeight, l.priceMode) : null
      const pd = ls?.perDiem ? Number(ls.perDiem) : 0
      return {
        ...l,
        deliveredWeight: dwTon,
        amount: adjustedAmount(l, dwTon),
        perDiem: pd,
        notes: ls?.notes || l.notes,
        closed: markClosed && (l.legType === 'return' || dwTon != null),
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
      // Lump pricing: deliveredWeight is optional (freight doesn't change)
      if (l.priceMode === 'lump' && (l.weight || 0) === 0) continue
      if (l.deliveredWeight == null || isNaN(l.deliveredWeight))
        return `ขา ${i + 1}: กรุณากรอกน้ำหนักปลายทาง`
      if (l.deliveredWeight > (l.weight || 0))
        return `ขา ${i + 1}: น้ำหนักปลาย (${l.deliveredWeight}) เกินน้ำหนักต้น (${l.weight})`
      const lossKg = ((l.weight || 0) - l.deliveredWeight) * 1000
      if (lossKg > MAX_WEIGHT_LOSS_KG)
        return `ขา ${i + 1}: น้ำหนักหาย ${lossKg.toFixed(0)} กก. เกินกำหนด ${MAX_WEIGHT_LOSS_KG} กก.`
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

      let finalLiters: number | null = round.liters
      let finalKmPerL: number | null = null

      if (mode === 'close') {
        // Create TRIP_CLOSING fuel transaction if liters provided
        if (closingL > 0) {
          db.add<FuelTransaction>('fuelTransactions', {
            id: uid('ftx'),
            date: new Date().toISOString().slice(0, 10),
            vehicleId: round.vehicleId ?? '',
            liters: closingL,
            pricePerL: 35,
            total: closingL * 35,
            source: 'FACTORY_TANK',
            tripId: round.id,
            status: 'TRIP_LINKED',
            tripFuelRole: 'TRIP_CLOSING',
            entryMethod: 'TRIP_CLOSE',
            createdAt: new Date().toISOString(),
            reversedAt: null,
            reversalOf: null,
            note: `TRIP_CLOSING สำหรับรอบ ${round.code}`,
          })
        }
        // Final fuel = INTERMEDIATE + NORMAL + TRIP_CLOSING (NOT TRIP_OPENING)
        finalLiters = totalFuelForKmpl > 0 ? totalFuelForKmpl : round.liters
        finalKmPerL = dist && finalLiters ? dist / finalLiters : null
      }

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
        liters: finalLiters,
        kmPerL: finalKmPerL,
        roundStatus: mode === 'close' ? 'closed' : 'draft',
        status: mode === 'close' ? 'completed' : round.status,
        progress: mode === 'close' ? 100 : round.progress,
      })
      setTick(t => t + 1)
      if (mode === 'close') {
        setToast({ kind: 'success', msg: `✅ ปิดรอบ ${round.code} เรียบร้อย${finalKmPerL ? ` · KM/L = ${finalKmPerL.toFixed(2)}` : ''}` })
        setTimeout(() => {
          setSubject(null)
          setActive('dispatch.open')
        }, 1400)
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
          const wUnit = weightUnitForLeg(l.priceMode)  // 'กก.' | 'ตัน'
          const isPerKg = l.priceMode === 'per_kg'
          // dw in canonical ตัน (for compare against l.weight which is ตัน)
          const dwTon = ls.deliveredWeight ? (dwInputToTon(ls.deliveredWeight, l.priceMode) ?? 0) : 0
          const filled = ls.deliveredWeight !== ''
          const isReturn = l.legType === 'return'
          const isLump = l.priceMode === 'lump'
          const lossKg = filled ? Math.max(0, (l.weight || 0) - dwTon) * 1000 : 0
          const exceeds = lossKg > MAX_WEIGHT_LOSS_KG
          const overweight = filled && dwTon > (l.weight || 0)
          const newAmount = adjustedLegAmounts[i]
          const diffAmount = newAmount - (l.amount || 0)
          // Loaded weight displayed in matching user unit
          const loadedWeightDisplay = isPerKg ? (l.weight || 0) * 1000 : (l.weight || 0)
          return (
            <div
              key={l.id || i}
              className="card pad"
              style={{ borderLeft: exceeds ? '3px solid var(--red)' : '3px solid transparent' }}
            >
              <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    ขา {i + 1} — {l.origin} → {l.destination}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {l.customerId ? (customers.find(c => c.id === l.customerId)?.name ?? '—') : '—'}
                    {' • '}{l.cargoType || '—'}
                    {' • '}<span className="badge" style={{ fontSize: 10.5 }}>{legTypeLabel(l.legType)}</span>
                    {' • '}<span className="badge" style={{ fontSize: 10.5 }}>
                      {isLump ? 'เหมา' : l.priceMode === 'per_kg' ? `${db.fmt(l.price)} ฿/กก.` : `${db.fmt(l.price)} ฿/ตัน`}
                    </span>
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
                <Field label={`น้ำหนักต้นทาง (${wUnit})`}>
                  <input
                    type="number"
                    value={loadedWeightDisplay}
                    disabled
                    style={{ background: 'var(--bg)' }}
                  />
                </Field>
                {!isReturn && (
                  <Field label={`น้ำหนักปลายทาง (${wUnit})${isLump ? '' : ' *'}`}>
                    <input
                      type="number"
                      step={isPerKg ? '1' : '0.001'}
                      value={ls.deliveredWeight}
                      onChange={e => updateLegState(i, { deliveredWeight: e.target.value })}
                      placeholder={isPerKg ? '0' : '0.00'}
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

              {/* Weight loss + adjusted amount */}
              {!isReturn && filled && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--bg)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                    <span className="muted">
                      {overweight
                        ? <span style={{ color: 'var(--red)' }}>❌ น้ำหนักปลายเกินต้น ({((dwTon - (l.weight || 0)) * 1000).toFixed(0)} กก.)</span>
                        : lossKg === 0
                          ? <span style={{ color: 'var(--green)' }}>✓ ส่งครบ {loadedWeightDisplay.toLocaleString()} {wUnit}</span>
                          : exceeds
                            ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>
                                ⚠️ น้ำหนักหาย {lossKg.toFixed(0)} กก. (เกินกำหนด {MAX_WEIGHT_LOSS_KG} กก.)
                              </span>
                            : <span style={{ color: 'var(--amber)' }}>
                                น้ำหนักหาย {lossKg.toFixed(0)} กก. (อยู่ในเกณฑ์ ≤ {MAX_WEIGHT_LOSS_KG} กก.)
                              </span>
                      }
                    </span>
                    {!isLump && (
                      <span className="muted">
                        ค่าขนส่งใหม่:{' '}
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {db.thb(newAmount)}
                        </span>
                        {Math.abs(diffAmount) > 0.01 && (
                          <span style={{ marginLeft: 6, color: diffAmount < 0 ? 'var(--red)' : 'var(--green)' }}>
                            ({diffAmount < 0 ? '' : '+'}{db.fmt(diffAmount)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
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

      {/* Fuel lifecycle card */}
      <h3 className="section-title" style={{ marginBottom: 10 }}>น้ำมันในรอบ</h3>
      <div className="card pad" style={{ marginBottom: 16 }}>

        {/* TRIP_OPENING — not counted */}
        {fuelOpening.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              เติมต้นรอบ (TRIP_OPENING) — ไม่นับในการคำนวณ KM/L
            </div>
            {fuelOpening.map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 12px', background: 'var(--bg)', borderRadius: 7, marginBottom: 4, opacity: 0.65,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {db.thaiDate(t.date)} · {t.source === 'FACTORY_TANK' ? 'คลังโรงงาน' : 'ปั้มนอก'}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                  {t.liters.toFixed(2)} L
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              ↑ น้ำมันนี้นับเป็น TRIP_CLOSING ของรอบก่อนหน้าแล้ว
            </div>
          </div>
        )}

        {/* INTERMEDIATE + NORMAL — counted */}
        {(fuelIntermediate.length > 0 || fuelNormal.length > 0) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              เติมระหว่างทาง — นับในการคำนวณ
            </div>
            {[...fuelIntermediate, ...fuelNormal].map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 12px', background: '#EFF6FF', borderRadius: 7, marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12 }}>
                  {db.thaiDate(t.date)} · {t.source === 'FACTORY_TANK' ? 'คลังโรงงาน' : 'ปั้มนอก'}
                  {t.tripFuelRole === 'NORMAL' && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>ทั่วไป</span>}
                </span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6' }}>
                  {t.liters.toFixed(2)} L
                </span>
              </div>
            ))}
            {(sumIntermediate + sumNormal) > 0 && (
              <div style={{ textAlign: 'right', fontSize: 11, color: '#3B82F6', fontWeight: 600, marginTop: 2 }}>
                รวม {(sumIntermediate + sumNormal).toFixed(2)} L
              </div>
            )}
          </div>
        )}

        {/* TRIP_CLOSING — input or saved */}
        <div style={{ borderTop: fuelOpening.length > 0 || fuelIntermediate.length > 0 || fuelNormal.length > 0 ? '1px solid var(--line)' : 'none', paddingTop: fuelOpening.length > 0 || fuelIntermediate.length > 0 || fuelNormal.length > 0 ? 14 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            เติมปลายรอบ (TRIP_CLOSING) — นับในการคำนวณ
          </div>
          {fuelClosing.length > 0 ? (
            fuelClosing.map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 12px', background: '#F0FDF4', borderRadius: 7, marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12 }}>บันทึกแล้ว · {db.thaiDate(t.date)}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
                  {t.liters.toFixed(2)} L ✓
                </span>
              </div>
            ))
          ) : (
            <Field label="จำนวนน้ำมันเติมปลายรอบ (ลิตร)">
              <input
                type="number"
                step="0.01"
                value={closingFuelLiters}
                onChange={e => setClosingFuelLiters(e.target.value)}
                placeholder="0.00"
                disabled={isClosed}
              />
            </Field>
          )}
        </div>

        {/* KM/L live preview */}
        {distance > 0 && (
          <div
            style={{
              marginTop: 14, padding: '12px 14px',
              background: isKmlLow ? '#FEF2F2' : (kmPerL != null ? '#F0FDF4' : 'var(--bg)'),
              borderRadius: 8, borderLeft: `3px solid ${isKmlLow ? 'var(--red)' : (kmPerL != null ? 'var(--green)' : 'var(--line)')}`,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              คำนวณ KM/L: {db.fmt(distance)} km ÷ (
              {sumIntermediate + sumNormal > 0 ? `${(sumIntermediate + sumNormal).toFixed(2)}L กลางทาง` : ''}
              {sumIntermediate + sumNormal > 0 && closingL > 0 ? ' + ' : ''}
              {closingL > 0 ? `${closingL.toFixed(2)}L ปลายรอบ` : (fuelClosing.length > 0 ? `${fuelClosing.reduce((s,t) => s + t.liters, 0).toFixed(2)}L ปลายรอบ` : '?L ปลายรอบ')}
              )
            </div>
            {kmPerL != null ? (
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: isKmlLow ? 'var(--red)' : 'var(--green)' }}>
                = {kmPerL.toFixed(2)} KM/L {isKmlLow ? '⚠️ ต่ำกว่าเกณฑ์' : '✓ ปกติ'}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>กรอกน้ำมันปลายรอบเพื่อคำนวณ</div>
            )}
          </div>
        )}

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
