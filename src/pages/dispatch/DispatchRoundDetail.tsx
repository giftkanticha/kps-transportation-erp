import { useState, useMemo, useEffect } from 'react'
import { db, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { useAuth } from '../../context/AuthContext'
import type { Vehicle, Employee, Dispatch, DispatchLeg, FuelRound, FuelTransaction, FuelRecord, EditApprovalRequest, KPSRole } from '../../types'
import { Icon, Field, LocationCombobox } from '../../components/ui'

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
  priceMode: 'per_ton' | 'per_kg' | 'lump'
  weight: string
  price: string
  legType: 'outbound' | 'backhaul' | 'return'
  notes: string
  wht: boolean
}

const EMPTY_LEG: LegFormState = {
  origin: '', destination: '', customerId: '', cargo: '', cargoType: '',
  priceMode: 'per_ton', weight: '', price: '', legType: 'outbound', notes: '', wht: false,
}

function legTypeLabel(t?: string): string {
  if (t === 'backhaul') return 'Backhaul'
  if (t === 'return') return 'Return (เปล่า)'
  return 'Outbound'
}

// A single truck/trailer load rarely exceeds ~60 ตัน. A larger ตัน value almost
// always means กก. was typed into a ตัน field — warn so the close screen never
// shows nonsense like "ส่งครบ 31,000 ตัน".
const MAX_REALISTIC_TON = 100

function calcLegAmount(priceMode: LegFormState['priceMode'], weightTon: number, price: number): number {
  if (priceMode === 'lump') return price
  if (priceMode === 'per_kg') return weightTon * 1000 * price
  return weightTon * price // per_ton
}

// Convert weight from form-input (user's chosen unit) to canonical ตัน for storage.
function inputWeightToTon(weightInput: string, mode: LegFormState['priceMode']): number {
  const n = Number(weightInput) || 0
  return mode === 'per_kg' ? n / 1000 : n
}

// Convert canonical ตัน → user's display unit (for editing existing legs).
function tonToDisplayWeight(weightTon: number, mode: LegFormState['priceMode']): string {
  if (!weightTon) return ''
  return mode === 'per_kg' ? String(weightTon * 1000) : String(weightTon)
}

function weightUnitLabel(mode: LegFormState['priceMode']): string {
  return mode === 'per_kg' ? 'กิโลกรัม' : 'ตัน'
}

function priceUnitLabel(mode: LegFormState['priceMode']): string {
  if (mode === 'lump') return 'บาท (เหมาทั้งเที่ยว)'
  if (mode === 'per_kg') return 'บาท/กิโลกรัม'
  return 'บาท/ตัน'
}

function LegModal({
  initial,
  onSave,
  onCancel,
}: {
  initial: LegFormState
  onSave: (f: LegFormState) => void
  onCancel: () => void
}) {
  const [f, setF] = useState(initial)
  const set = <K extends keyof LegFormState>(k: K, v: LegFormState[K]) => setF(s => ({ ...s, [k]: v }))
  const isReturn = f.legType === 'return'
  const isLump = f.priceMode === 'lump'

  // Switching priceMode auto-converts the weight value so the displayed number
  // represents the same load in the new unit.
  const onPriceModeChange = (newMode: LegFormState['priceMode']) => {
    const oldMode = f.priceMode
    if (oldMode === newMode) return
    let nextWeight = f.weight
    if (oldMode === 'per_ton' && newMode === 'per_kg') {
      nextWeight = f.weight ? String(Number(f.weight) * 1000) : ''
    } else if (oldMode === 'per_kg' && newMode === 'per_ton') {
      nextWeight = f.weight ? String(Number(f.weight) / 1000) : ''
    }
    setF(s => ({ ...s, priceMode: newMode, weight: nextWeight }))
  }

  // f.weight is in user-unit (matches priceMode). For per_kg → input is กก., calc直接 input × price.
  const wInput = Number(f.weight) || 0
  const p = Number(f.price) || 0
  // amount = weight × price when units match (per_ton: ตัน×฿/ตัน, per_kg: กก.×฿/กก.). Lump: just price.
  const previewAmount = isReturn ? 0 : isLump ? p : wInput * p

  const submit = () => {
    if (!f.origin.trim()) return alert('กรุณากรอกต้นทาง')
    if (!f.destination.trim()) return alert('กรุณากรอกปลายทาง')
    if (!isReturn) {
      if (!isLump && !Number(f.weight)) return alert('กรุณากรอกน้ำหนักโหลด')
      if (!Number(f.price)) return alert(`กรุณากรอกราคา (${priceUnitLabel(f.priceMode)})`)
      if (f.priceMode !== 'per_kg' && wInput > MAX_REALISTIC_TON) {
        if (!confirm(`น้ำหนัก ${wInput.toLocaleString()} ตัน สูงผิดปกติ (ปกติ ≤ ${MAX_REALISTIC_TON} ตัน)\n\nถ้านี่คือค่าจากใบชั่ง (กก.) ควรกรอก ${(wInput / 1000).toLocaleString()} ตัน หรือเปลี่ยนหน่วยราคาเป็น "ต่อกิโลกรัม"\n\nยืนยันบันทึกค่านี้?`))
          return
      }
    }
    onSave(f)
  }

  // 'บันทึกร่าง' lets the user save partial leg data and come back to fill
  // in weight / price later (e.g. they don't have the weighbridge ticket yet).
  // Only requires that at least one of origin / destination is set so the
  // leg shows up in the list meaningfully.
  const submitDraft = () => {
    if (!f.origin.trim() && !f.destination.trim()) {
      return alert('กรุณากรอกอย่างน้อย ต้นทาง หรือ ปลายทาง')
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
              <LocationCombobox value={f.origin} onChange={v => set('origin', v)} placeholder="เช่น โรงงาน KPS" />
            </Field>
            <Field label="ปลายทาง *">
              <LocationCombobox value={f.destination} onChange={v => set('destination', v)} placeholder="เช่น กรุงเทพ" />
            </Field>
          </div>
          {!isReturn && (
            <>
              <div className="grid-2" style={{ gap: 12 }}>
                <Field label="ประเภทสินค้า">
                  <input value={f.cargoType} onChange={e => set('cargoType', e.target.value)} placeholder="เช่น ปูนซีเมนต์" />
                </Field>
                <Field label="รายละเอียดสินค้า">
                  <input value={f.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Optional" />
                </Field>
              </div>

              <Field label="รูปแบบราคา *">
                <div className="row" style={{ gap: 16, paddingTop: 4 }}>
                  {([
                    { v: 'per_ton', l: 'ต่อตัน', h: '฿/ตัน' },
                    { v: 'per_kg',  l: 'ต่อกิโลกรัม', h: '฿/กก.' },
                    { v: 'lump',    l: 'เหมา', h: '฿ ทั้งเที่ยว' },
                  ] as const).map(opt => (
                    <label key={opt.v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="radio"
                        name="leg-price-mode"
                        checked={f.priceMode === opt.v}
                        onChange={() => onPriceModeChange(opt.v)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>{opt.l} <span className="muted" style={{ fontSize: 11 }}>({opt.h})</span></span>
                    </label>
                  ))}
                </div>
              </Field>

              <div className="grid-2" style={{ gap: 12 }}>
                {!isLump && (
                  <Field label={`น้ำหนักโหลด (${weightUnitLabel(f.priceMode)}) *`}>
                    <input
                      type="number"
                      step={f.priceMode === 'per_kg' ? '1' : '0.01'}
                      value={f.weight}
                      onChange={e => set('weight', e.target.value)}
                      placeholder={f.priceMode === 'per_kg' ? '0' : '0.00'}
                    />
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {f.priceMode === 'per_kg'
                        ? <>หน่วย <strong>กิโลกรัม</strong> ({wInput > 0 ? `= ${(wInput / 1000).toFixed(3)} ตัน` : 'เช่น 25,000 = 25 ตัน'})</>
                        : <>หน่วย <strong>ตัน</strong> ({wInput > 0 ? `= ${(wInput * 1000).toLocaleString()} กก.` : 'เช่น 25 = 25,000 กก.'})</>
                      }
                    </div>
                    {f.priceMode !== 'per_kg' && wInput > MAX_REALISTIC_TON && (
                      <div style={{ fontSize: 11, marginTop: 4, color: 'var(--red)', fontWeight: 600 }}>
                        ⚠️ {wInput.toLocaleString()} ตัน สูงผิดปกติ — ถ้านี่คือค่าจากใบชั่ง (กก.) ให้กรอกเป็น {(wInput / 1000).toLocaleString()} หรือเปลี่ยนหน่วยราคาเป็น “ต่อกิโลกรัม”
                      </div>
                    )}
                  </Field>
                )}
                <Field label={`ราคา (${priceUnitLabel(f.priceMode)}) *`}>
                  <input
                    type="number" step="0.01" value={f.price}
                    onChange={e => set('price', e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>

              {/* Live calc preview */}
              <div
                style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: previewAmount > 0 ? '#EFF6FF' : 'var(--bg)',
                  border: previewAmount > 0 ? '1px solid #BFDBFE' : '1px dashed var(--line)',
                  fontSize: 12.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span className="muted">
                  {f.priceMode === 'lump'
                    ? <>เหมา: <strong>{p > 0 ? db.fmt(p) : '—'} บาท</strong></>
                    : <>คำนวณ: {wInput.toLocaleString()} {weightUnitLabel(f.priceMode)} × {p || 0} ฿/{weightUnitLabel(f.priceMode) === 'ตัน' ? 'ตัน' : 'กก.'}</>
                  }
                </span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>
                  = {db.fmt(previewAmount)} บาท
                </span>
              </div>
            </>
          )}
          {f.legType !== 'outbound' && (
            <div
              style={{
                padding: '10px 14px', borderRadius: 8,
                background: f.wht ? '#FEF3C7' : 'var(--bg)',
                border: f.wht ? '1px solid #FCD34D' : '1px dashed var(--line)',
              }}
            >
              <label className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={f.wht}
                  onChange={e => set('wht', e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>ลูกค้าหักภาษี ณ ที่จ่าย 1% (ขากลับ)</span>
              </label>
              {f.wht && !isReturn && previewAmount > 0 && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  หัก − {db.fmt(previewAmount * 0.01)} บาท → รับสุทธิ <strong>{db.fmt(previewAmount * 0.99)}</strong> บาท
                </div>
              )}
            </div>
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
            <button
              className="btn"
              onClick={submitDraft}
              title="บันทึกข้อมูลที่กรอกไว้ — เติมน้ำหนัก/ราคาภายหลังได้"
            >
              <Icon name="edit" size={15} /> บันทึกร่าง
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

function ClosedSummary({ round, fuelRound, isManager }: { round: Dispatch; fuelRound: FuelRound | null; isManager: boolean }) {
  const legs = round.legs ?? []
  const revenue = db.roundRevenue(round)
  const perDiemTotal = db.roundPerDiem(round)
  const otherTotal = db.roundOtherExpenses(round)
  const fuelCost = fuelRound ? db.fuelRoundCost(fuelRound) : (round.cost || 0)
  const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (round.liters || 0)
  const distance = db.roundDistance(round)
  const profit = revenue - fuelCost - perDiemTotal - otherTotal
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0
  const kmPerL = consumed > 0 ? distance / consumed : null
  const isLow = kmPerL != null && kmPerL < DSP_KMPL_THRESHOLD

  const startR = fuelRound?.refills.find(r => r.type === 'start')
  const inters = fuelRound?.refills.filter(r => r.type === 'intermediate') ?? []
  const endR = fuelRound?.refills.find(r => r.type === 'end')

  const departTime = round.depart?.slice(11, 16) || '—'
  const returnTime = round.returnAt?.slice(11, 16) || '—'

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fuelRound && (
        <div className="card">
          <div className="head"><h3>⛽ Timeline การเติมน้ำมัน (Round {fuelRound.code})</h3></div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {startR && (
              <div style={{ padding: 10, borderRadius: 6, background: 'var(--bg)', fontSize: 12.5 }}>
                <div style={{ fontWeight: 600 }}>📍 START FULL — {startR.location}</div>
                <div className="muted" style={{ marginTop: 2 }}>
                  ⏰ {startR.at.slice(11, 16)} ({db.fmt(startR.mileage)} km) ·
                  🛢️ {startR.liters} L
                  {isManager && <> · 💰 ฿{db.fmt(startR.cost)} <em>(คิดในรอบก่อน)</em></>}
                </div>
              </div>
            )}
            {inters.map((r, i) => (
              <div key={r.id} style={{ padding: 10, borderRadius: 6, background: '#EFF6FF', fontSize: 12.5, border: '1px solid #BFDBFE' }}>
                <div style={{ fontWeight: 600 }}>➕ INTERMEDIATE #{i + 1} — {r.location}</div>
                <div className="muted" style={{ marginTop: 2 }}>
                  ⏰ {r.at.slice(11, 16)} ({db.fmt(r.mileage)} km) ·
                  🛢️ {r.liters} L
                  {isManager && <> · 💰 ฿{db.fmt(r.cost)}</>}
                </div>
              </div>
            ))}
            {endR && (
              <div style={{ padding: 10, borderRadius: 6, background: '#ECFDF5', fontSize: 12.5, border: '1px solid #A7F3D0' }}>
                <div style={{ fontWeight: 600 }}>🏁 END FULL — {endR.location}</div>
                <div className="muted" style={{ marginTop: 2 }}>
                  ⏰ {endR.at.slice(11, 16)} ({db.fmt(endR.mileage)} km) ·
                  🛢️ {endR.liters} L (จนเต็ม)
                  {isManager && <> · 💰 ฿{db.fmt(endR.cost)}</>}
                </div>
              </div>
            )}
            <div
              style={{
                marginTop: 6, padding: 12, borderRadius: 6,
                background: 'var(--card)', border: '1px dashed var(--line)',
                fontFamily: 'var(--font-mono)', fontSize: 12.5,
              }}
            >
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr><td>Start FULL:</td><td className="num right">{startR?.liters ?? 0} L</td></tr>
                  <tr><td>+ Intermediate:</td><td className="num right">{db.fuelRoundIntermediateTotal(fuelRound)} L</td></tr>
                  <tr><td>+ End fill:</td><td className="num right">{endR?.liters ?? 0} L</td></tr>
                  <tr style={{ borderTop: '1px dashed var(--line)' }}>
                    <td style={{ paddingTop: 6, fontWeight: 600 }}>🎯 Consumed:</td>
                    <td className="num right" style={{ paddingTop: 6, fontWeight: 700, color: '#0066CC' }}>{consumed.toFixed(1)} L</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>📊 Efficiency:</td>
                    <td className="num right" style={{ fontWeight: 700, color: isLow ? '#EF4444' : '#10B981' }}>
                      {kmPerL?.toFixed(2) ?? '—'} km/L {isLow && '⚠️'}
                    </td>
                  </tr>
                  {isManager && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>💰 Fuel cost:</td>
                      <td className="num right" style={{ fontWeight: 700 }}>฿{db.fmt(fuelCost)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* P&L summary — manager+ only; drivers see distance/KM-L below only */}
      {isManager && (
      <div className="card">
        <div className="head"><h3>📊 สรุป P&amp;L</h3></div>
        <div style={{ padding: 18 }}>
          <div className="grid-2" style={{ gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', marginBottom: 6 }}>📈 รายได้</div>
              <div className="row" style={{ fontSize: 13 }}>
                <span>ค่าขนส่ง ({legs.length} ขา)</span>
                <span className="spacer" />
                <span className="mono">{db.thb(revenue)}</span>
              </div>
              {db.roundWht(round) > 0 && (
                <>
                  <div className="row" style={{ fontSize: 13, color: 'var(--amber)' }}>
                    <span>หัก ณ ที่จ่าย 1%</span>
                    <span className="spacer" />
                    <span className="mono">− {db.thb(db.roundWht(round))}</span>
                  </div>
                  <div className="row" style={{ fontSize: 13, fontWeight: 600, borderTop: '1px dashed var(--line)', paddingTop: 4, marginTop: 4 }}>
                    <span>รับสุทธิจากลูกค้า</span>
                    <span className="spacer" />
                    <span className="mono">{db.thb(db.roundNetRevenue(round))}</span>
                  </div>
                </>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', marginBottom: 6 }}>💸 ค่าใช้จ่าย</div>
              <div className="row" style={{ fontSize: 13 }}><span>ค่าน้ำมัน</span><span className="spacer" /><span className="mono">฿{db.fmt(fuelCost)}</span></div>
              <div className="row" style={{ fontSize: 13 }}><span>เบี้ยเลี้ยง</span><span className="spacer" /><span className="mono">฿{db.fmt(perDiemTotal)}</span></div>
              <div className="row" style={{ fontSize: 13 }}><span>ค่าใช้จ่ายอื่น</span><span className="spacer" /><span className="mono">฿{db.fmt(otherTotal)}</span></div>
              <div className="row" style={{ fontSize: 13, fontWeight: 600, borderTop: '1px dashed var(--line)', paddingTop: 4, marginTop: 4 }}>
                <span>รวม</span><span className="spacer" /><span className="mono">฿{db.fmt(fuelCost + perDiemTotal + otherTotal)}</span>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 18, padding: 14,
              background: profit >= 0 ? '#ECFDF5' : '#FEE2E2',
              border: `1px solid ${profit >= 0 ? '#10B981' : '#EF4444'}`,
              borderRadius: 8,
            }}
          >
            <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>💚 กำไรสุทธิ</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: profit >= 0 ? '#10B981' : '#EF4444' }}>
                  {db.thb(profit)}
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>อัตรากำไร</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{margin.toFixed(1)}%</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>ระยะทาง</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{db.fmt(distance)} km</div>
              </div>
              {kmPerL != null && (
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>KM/L</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: isLow ? '#EF4444' : 'var(--text-1)' }}>
                    {kmPerL.toFixed(2)} {isLow && '⚠️'}
                  </div>
                </div>
              )}
              <div>
                <div className="muted" style={{ fontSize: 11 }}>เวลา</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  ออก {departTime} → ถึง {returnTime}
                </div>
              </div>
            </div>
          </div>

          {/* Per-leg delivery details */}
          {legs.some(l => l.deliveredWeight != null || (l.perDiem || 0) > 0) && (
            <div style={{ marginTop: 18 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>รายละเอียดการส่งของแต่ละขา</h4>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ขา</th>
                    <th>เส้นทาง</th>
                    <th className="num">โหลด</th>
                    <th className="num">ส่ง</th>
                    <th className="num">ผลต่าง</th>
                    <th className="num">เบี้ยเลี้ยง</th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((l, i) => {
                    const dw = l.deliveredWeight ?? 0
                    const isReturn = l.legType === 'return'
                    const diff = isReturn ? 0 : (l.weight || 0) - dw
                    return (
                      <tr key={l.id || i}>
                        <td>{i + 1}</td>
                        <td>{l.origin} → {l.destination}</td>
                        <td className="num">{isReturn ? '—' : (l.weight || 0).toFixed(2)}</td>
                        <td className="num">{isReturn ? '—' : (l.deliveredWeight != null ? dw.toFixed(2) : '—')}</td>
                        <td className="num">
                          {isReturn
                            ? '—'
                            : (diff > 0.001
                              ? <span style={{ color: 'var(--amber)' }}>⚠️ {diff.toFixed(2)}</span>
                              : <span style={{ color: 'var(--green)' }}>ครบ</span>)}
                        </td>
                        <td className="num">฿{db.fmt(l.perDiem || 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(round.otherExpenses ?? []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>ค่าใช้จ่ายอื่นๆ</h4>
              <table className="tbl">
                <thead>
                  <tr><th>รายการ</th><th className="num">จำนวน</th></tr>
                </thead>
                <tbody>
                  {(round.otherExpenses ?? []).map(e => (
                    <tr key={e.id}>
                      <td>{e.label}</td>
                      <td className="num">฿{db.fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

// ─── Payment status (decoupled from round close) ──────────────────────────────
const PAYMENT_LABEL: Record<string, { text: string; cls: string }> = {
  paid:    { text: 'ชำระแล้ว',     cls: 'green' },
  partial: { text: 'ชำระบางส่วน',  cls: 'amber' },
  unpaid:  { text: 'ยังไม่ชำระ',   cls: 'red' },
}

function PaymentPanel({ round, onPay }: { round: Dispatch; onPay: () => void }) {
  const net = db.roundNetRevenue(round)
  const paid = round.amountPaid || 0
  const outstanding = Math.max(0, net - paid)
  const status = round.paymentStatus || 'unpaid'
  const lbl = PAYMENT_LABEL[status] ?? PAYMENT_LABEL.unpaid

  return (
    <div className="card pad" style={{ marginTop: 16 }}>
      <div className="row" style={{ alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>สถานะการชำระเงิน</div>
          <span className={`badge ${lbl.cls}`} style={{ fontSize: 12, marginTop: 2 }}>{lbl.text}</span>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>ยอดรับสุทธิ (หลังหัก ณ ที่จ่าย)</div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{db.thb(net)}</div>
        </div>
        {paid > 0 && (
          <div>
            <div className="muted" style={{ fontSize: 11 }}>รับชำระแล้ว</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)' }}>{db.thb(paid)}</div>
          </div>
        )}
        {outstanding > 0 && (
          <div>
            <div className="muted" style={{ fontSize: 11 }}>คงค้าง</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>{db.thb(outstanding)}</div>
          </div>
        )}
        {round.paidAt && (
          <div>
            <div className="muted" style={{ fontSize: 11 }}>วันที่รับชำระ</div>
            <div style={{ fontSize: 13 }}>{db.thaiDate(round.paidAt)}</div>
          </div>
        )}
        <div className="spacer" style={{ flex: 1 }} />
        <button className="btn primary" onClick={onPay}>
          <Icon name="money" size={15} /> {status === 'paid' ? 'แก้ไขการชำระ' : 'บันทึกชำระเงิน'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
        💡 การชำระเงินแยกจากการปิดงาน — ปิดงานได้แม้ยังไม่ได้รับเงิน ยอดค้างจะถูกเตือนในแดชบอร์ด
      </div>
    </div>
  )
}

function PaymentModal({
  round, onClose, onSaved, updateDispatch,
}: {
  round: Dispatch
  onClose: () => void
  onSaved: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDispatch: any
}) {
  const net = db.roundNetRevenue(round)
  const alreadyPaid = round.amountPaid || 0
  const outstanding = Math.max(0, net - alreadyPaid)
  const [amount, setAmount] = useState(String(outstanding > 0 ? outstanding : net))
  const [paidDate, setPaidDate] = useState((round.paidAt || new Date().toISOString()).slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr('')
    const totalPaid = alreadyPaid + (Number(amount) || 0)
    // ผู้ใช้บันทึกยอด "ที่รับเพิ่มครั้งนี้"; สะสมกับที่เคยรับมาก่อน
    const paymentStatus: Dispatch['paymentStatus'] =
      totalPaid <= 0 ? 'unpaid' : totalPaid + 0.01 >= net ? 'paid' : 'partial'
    setBusy(true)
    try {
      await updateDispatch.mutateAsync({
        id: round.id,
        patch: {
          amountPaid: totalPaid,
          paymentStatus,
          paidAt: paymentStatus === 'unpaid' ? null : new Date(paidDate).toISOString(),
        },
      })
      onSaved()
    } catch (e) {
      setErr('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  const markFullyPaid = () => setAmount(String(outstanding > 0 ? outstanding : net))

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="head"><h3>💰 บันทึกการชำระเงิน — {round.code}</h3></div>
        <div className="body">
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{err}</div>
          )}
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
            <div className="row"><span>ยอดรับสุทธิ (หลังหัก ณ ที่จ่าย)</span><div className="spacer" /><span className="mono">{db.thb(net)}</span></div>
            {alreadyPaid > 0 && <div className="row" style={{ color: 'var(--green)' }}><span>รับชำระแล้วก่อนหน้า</span><div className="spacer" /><span className="mono">{db.thb(alreadyPaid)}</span></div>}
            <div className="row" style={{ fontWeight: 600, borderTop: '1px dashed var(--line)', paddingTop: 4, marginTop: 4 }}><span>คงค้าง</span><div className="spacer" /><span className="mono" style={{ color: outstanding > 0 ? 'var(--red)' : 'var(--green)' }}>{db.thb(outstanding)}</span></div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="ยอดที่รับครั้งนี้ *">
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              <button className="btn ghost sm" onClick={markFullyPaid} style={{ marginTop: 6, fontSize: 12 }}>รับเต็มจำนวนคงค้าง</button>
            </Field>
            <Field label="วันที่รับชำระ">
              <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={busy}>
            <Icon name="check" size={14} /> {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DispatchRoundDetail({ setActive, setSubject, subject }: Props) {
  const { isManager, isAdmin, profile } = useAuth()
  const [showEditRound, setShowEditRound] = useState(false)
  const [showDeleteRound, setShowDeleteRound] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)
  const [showRequestEdit, setShowRequestEdit] = useState(false)
  const subj = subject as { type?: string; id?: string } | null
  const { data: dispatches = [] } = useDispatches()
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: fuelRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { data: allFuelTxs = [] } = useList<FuelTransaction>('fuel_transactions')
  const { data: allFuelRecs = [] } = useList<FuelRecord>('fuel_records')
  const insertLeg = useInsert<DispatchLeg>('dispatch_legs')
  const updateLeg = useUpdate<DispatchLeg>('dispatch_legs')
  const removeLeg = useDelete('dispatch_legs')
  const updateDispatch = useUpdate<Dispatch>('dispatch')
  const updateFuelTx = useUpdate<FuelTransaction>('fuel_transactions')
  const deleteFuelRec = useDelete('fuel_records')
  const deleteDispatch = useDelete('dispatch')
  const insertApproval = useInsert<EditApprovalRequest>('edit_approvals')

  const round = useMemo(
    () => (subj?.id ? dispatches.find(d => d.id === subj.id) : undefined),
    [subj?.id, dispatches],
  )

  const [editingLeg, setEditingLeg] = useState<{ index: number; data: LegFormState } | null>(null)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [showPay, setShowPay] = useState(false)
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
  const fuelRound = db.fuelRoundOfDispatch(round.id, fuelRounds)

  // Legs live in the dispatch_legs table; each save is a row insert/update plus a
  // revenue recompute on the parent dispatch row. revenue/totalAmount are derived
  // from the resulting leg set (computed locally to avoid awaiting a refetch).
  const saveLeg = async (form: LegFormState) => {
    if (!editingLeg) return
    const isReturn = form.legType === 'return'
    // form.weight is in user's chosen unit (กก. or ตัน) → convert to canonical ตัน for storage
    const weightTon = inputWeightToTon(form.weight, form.priceMode)
    const price = Number(form.price) || 0
    const amount = isReturn ? 0 : calcLegAmount(form.priceMode, weightTon, price)
    const fields = {
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      customerId: form.customerId || null,
      cargo: form.cargo.trim(),
      cargoType: form.cargoType.trim(),
      priceMode: form.priceMode,
      weight: weightTon,
      price,
      amount,
      legType: form.legType,
      notes: form.notes.trim() || null,
      wht: form.legType !== 'outbound' ? form.wht : false,
    } as Partial<DispatchLeg>
    try {
      let nextLegs: DispatchLeg[]
      if (editingLeg.index < 0) {
        const created = await insertLeg.mutateAsync({
          ...fields,
          dispatchId: round.id,
          sortOrder: legs.length,
          deliveredWeight: null,
          perDiem: 0,
          closed: false,
        })
        nextLegs = [...legs, created]
      } else {
        const existing = legs[editingLeg.index]
        const updated = await updateLeg.mutateAsync({ id: existing.id as string, patch: fields })
        nextLegs = legs.map((l, ix) => (ix === editingLeg.index ? updated : l))
      }
      const newRevenue = nextLegs.reduce((s, l) => s + (l.amount || 0), 0)
      await updateDispatch.mutateAsync({ id: round.id, patch: { totalAmount: newRevenue, revenue: newRevenue } })
      setEditingLeg(null)
      setToast({ kind: 'success', msg: '✅ บันทึกขาเรียบร้อย' })
    } catch (e) {
      setToast({ kind: 'error', msg: '❌ บันทึกไม่สำเร็จ: ' + (e as Error).message })
    }
  }

  const deleteLeg = async (i: number) => {
    const target = legs[i]
    try {
      if (target?.id) await removeLeg.mutateAsync(target.id)
      const next = legs.filter((_, ix) => ix !== i)
      const newRevenue = next.reduce((s, l) => s + (l.amount || 0), 0)
      await updateDispatch.mutateAsync({ id: round.id, patch: { totalAmount: newRevenue, revenue: newRevenue } })
      setDeletingIndex(null)
      setToast({ kind: 'success', msg: '✅ ลบขาเรียบร้อย' })
    } catch (e) {
      setToast({ kind: 'error', msg: '❌ ลบไม่สำเร็จ: ' + (e as Error).message })
    }
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
        <div className="actions no-print">
          {!isClosed && (
            <button className="btn" onClick={() => setShowEditRound(true)} title="แก้ไขวันที่/เลขไมล์/คนขับ/รถ">
              <Icon name="edit" size={14} /> แก้ไขรอบ
            </button>
          )}
          {isAdmin && (
            <button
              className="btn"
              style={{ color: 'var(--red)', borderColor: '#fecaca' }}
              onClick={() => setShowDeleteRound(true)}
              title="ลบรอบนี้ถาวร"
            >
              <Icon name="trash" size={14} /> ลบรอบ
            </button>
          )}
          {!isClosed && (
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
          )}
          {isClosed && isAdmin && (
            <button
              className="btn"
              onClick={() => setShowReopenConfirm(true)}
              title="ตั้งสถานะรอบกลับเป็น DRAFT เพื่อแก้ไข"
            >
              <Icon name="edit" size={14} /> เปิดเพื่อแก้ไข
            </button>
          )}
          {isClosed && !isAdmin && (
            <button
              className="btn"
              onClick={() => setShowRequestEdit(true)}
              title="ส่งคำขอแก้ไขให้แอดมิน"
            >
              <Icon name="bell" size={14} /> ขอแก้ไข
            </button>
          )}
          {isClosed && (
            <button className="btn" onClick={() => window.print()}>
              <Icon name="download" size={15} /> พิมพ์ / PDF
            </button>
          )}
        </div>
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
          {isManager && (
            <div>
              <div className="muted" style={{ fontSize: 11 }}>รายได้รวม</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)' }}>{db.thb(totalRevenue)}</div>
            </div>
          )}
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
                  <th>สินค้า</th>
                  <th>ประเภท</th>
                  <th className="num">น้ำหนัก (ตัน)</th>
                  {isManager && <th className="num right">ค่าขนส่ง</th>}
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
                    <td>{l.cargoType || <span className="muted">—</span>}</td>
                    <td><span className="badge" style={{ fontSize: 11 }}>{legTypeLabel(l.legType)}</span></td>
                    <td className="num">{(l.weight || 0).toFixed(2)}</td>
                    {isManager && (
                      <td className="num right">
                        {db.thb(l.amount)}
                        {l.wht && (
                          <div className="muted" style={{ fontSize: 10.5, color: 'var(--amber)' }}>
                            หัก 1% → {db.thb((l.amount || 0) * 0.99)}
                          </div>
                        )}
                      </td>
                    )}
                    {!isClosed && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button
                            className="btn ghost icon sm"
                            title="แก้ไข"
                            onClick={() => {
                              const mode = l.priceMode || 'per_ton'
                              setEditingLeg({
                                index: i,
                                data: {
                                  origin: l.origin,
                                  destination: l.destination,
                                  customerId: l.customerId || '',
                                  cargo: l.cargo || '',
                                  cargoType: l.cargoType || '',
                                  priceMode: mode,
                                  weight: tonToDisplayWeight(l.weight || 0, mode),
                                  price: String(l.price || ''),
                                  legType: l.legType ?? 'outbound',
                                  notes: l.notes || '',
                                  wht: l.wht ?? false,
                                },
                              })
                            }}
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
                  <td colSpan={4} className="right">รวม {legs.length} ขา</td>
                  <td className="num">{totalWeight.toFixed(2)}</td>
                  {isManager && (
                    <td className="num right" style={{ color: 'var(--green)' }}>
                      {db.thb(totalRevenue)}
                      {db.roundWht(round) > 0 && (
                        <div className="muted" style={{ fontSize: 10.5, color: 'var(--amber)', fontWeight: 500 }}>
                          หัก 1% รวม − {db.thb(db.roundWht(round))} → สุทธิ {db.thb(db.roundNetRevenue(round))}
                        </div>
                      )}
                    </td>
                  )}
                  {!isClosed && <td></td>}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isClosed && isManager && <PaymentPanel round={round} onPay={() => setShowPay(true)} />}

      {isClosed && <ClosedSummary round={round} fuelRound={fuelRound} isManager={isManager} />}

      {showPay && isClosed && isManager && (
        <PaymentModal
          round={round}
          onClose={() => setShowPay(false)}
          onSaved={() => { setShowPay(false); setToast({ kind: 'success', msg: '✅ บันทึกการชำระเงินแล้ว' }) }}
          updateDispatch={updateDispatch}
        />
      )}

      {editingLeg && (
        <LegModal
          initial={editingLeg.data}
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

      {showEditRound && !isClosed && (
        <EditRoundModal
          round={round}
          vehicles={vehicles}
          employees={employees}
          updateDispatch={updateDispatch}
          onClose={() => setShowEditRound(false)}
          onSaved={() => {
            setShowEditRound(false)
            setToast({ kind: 'success', msg: '✅ อัปเดตข้อมูลรอบแล้ว' })
          }}
        />
      )}

      {showReopenConfirm && isClosed && isAdmin && (
        <div className="modal-bg" onClick={() => setShowReopenConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="head"><h3>เปิดรอบเพื่อแก้ไข</h3></div>
            <div className="body">
              <p style={{ marginBottom: 12 }}>
                รอบ <strong className="mono" style={{ color: 'var(--primary)' }}>{round.code}</strong> ปิดอยู่
              </p>
              <p className="muted" style={{ fontSize: 13 }}>
                กดยืนยันจะตั้งสถานะรอบเป็น <strong>DRAFT</strong> และพาไปหน้าปิดรอบเพื่อแก้ไขข้อมูล —
                ปิดรอบใหม่อีกครั้งเมื่อแก้เสร็จ
              </p>
            </div>
            <div className="foot">
              <button className="btn" onClick={() => setShowReopenConfirm(false)}>ยกเลิก</button>
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    await updateDispatch.mutateAsync({
                      id: round.id,
                      patch: { roundStatus: 'draft', status: 'in-progress' },
                    })
                    setShowReopenConfirm(false)
                    setSubject({ type: 'round', id: round.id })
                    setActive('dispatch.close')
                  } catch (e) {
                    setToast({ kind: 'error', msg: e instanceof Error ? e.message : 'เปิดรอบไม่สำเร็จ' })
                  }
                }}
              >
                <Icon name="edit" size={14} /> เปิดเพื่อแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestEdit && isClosed && !isAdmin && profile && (
        <RequestEditRoundModal
          round={round}
          onClose={() => setShowRequestEdit(false)}
          onSubmit={async (fields, reason) => {
            try {
              await insertApproval.mutateAsync({
                requesterId:   profile.id,
                requesterName: profile.display_name ?? profile.username ?? profile.email ?? 'ผู้ใช้',
                requesterRole: (String(profile.role).toLowerCase() === 'manager' ? 'manager' : 'driver') as KPSRole,
                vehicleId:     round.vehicleId ?? '',
                vehiclePlate:  vehicles.find(v => v.id === round.vehicleId)?.plate ?? round.code,
                reason,
                changes: {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  _kind: 'dispatch_reopen',
                  roundId: round.id,
                  roundCode: round.code,
                  fields,
                } as Partial<Vehicle>,
                changeFields: fields.map(f => ({ key: f, label: f, before: '', after: 'แก้ไข' })),
                requestedAt:  new Date().toISOString(),
                status:       'pending',
                reviewerId:   null,
                reviewerName: null,
                reviewedAt:   null,
                reviewNote:   '',
              })
              setShowRequestEdit(false)
              setToast({ kind: 'success', msg: '✅ ส่งคำขอให้แอดมินแล้ว' })
            } catch (e) {
              setToast({ kind: 'error', msg: 'ส่งคำขอไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) })
            }
          }}
        />
      )}

      {showDeleteRound && isAdmin && (
        <DeleteRoundModal
          round={round}
          linkedFuelTxs={allFuelTxs.filter(t => t.tripId === round.id)}
          mirrorFuelRecs={allFuelRecs.filter(r => r.code?.startsWith(`TRIP-${round.code}-`))}
          onClose={() => setShowDeleteRound(false)}
          onConfirm={async () => {
            try {
              // 1) Unlink fuel transactions so they don't dangle as TRIP_LINKED
              //    with a null trip_id (FK is ON DELETE SET NULL).
              for (const tx of allFuelTxs.filter(t => t.tripId === round.id)) {
                await updateFuelTx.mutateAsync({
                  id: tx.id,
                  patch: { tripId: null, status: 'FLOATING' },
                })
              }
              // 2) Delete the fuel_records mirror (TRIP-{code}-CLOSE etc.).
              for (const rec of allFuelRecs.filter(r => r.code?.startsWith(`TRIP-${round.code}-`))) {
                await deleteFuelRec.mutateAsync(rec.id)
              }
              // 3) Delete the round — dispatch_legs cascade automatically.
              await deleteDispatch.mutateAsync(round.id)
              setShowDeleteRound(false)
              setActive('dispatch.open')
            } catch (e) {
              setToast({ kind: 'error', msg: 'ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) })
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Delete round modal (admin only) ──────────────────────────────────────────
function DeleteRoundModal({
  round, linkedFuelTxs, mirrorFuelRecs, onClose, onConfirm,
}: {
  round: Dispatch
  linkedFuelTxs: FuelTransaction[]
  mirrorFuelRecs: FuelRecord[]
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const isClosed = round.roundStatus === 'closed'
  const ok = confirm === round.code

  const submit = async () => {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="head"><h3>🗑️ ลบรอบ {round.code}</h3></div>
        <div className="body">
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 8, fontSize: 13.5 }}>
              ⚠️ การลบนี้ทำถาวร ย้อนกลับไม่ได้
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.8 }}>
              <li>รอบ <strong className="mono">{round.code}</strong> + ขา <strong>{round.legs?.length ?? 0}</strong> ขา จะถูกลบ</li>
              {linkedFuelTxs.length > 0 && (
                <li>น้ำมัน <strong>{linkedFuelTxs.length}</strong> รายการที่ผูกกับรอบนี้จะกลายเป็น "น้ำมันลอย" (ผูกใหม่ได้)</li>
              )}
              {mirrorFuelRecs.length > 0 && (
                <li>บันทึก fuel_records mirror <strong>{mirrorFuelRecs.length}</strong> ของรอบนี้จะถูกลบด้วย</li>
              )}
              {isClosed && (
                <li>รอบนี้สถานะ <strong>CLOSED</strong> — รายงาน P&L รายเดือนจะหายส่วนนี้</li>
              )}
            </ul>
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            พิมพ์รหัสรอบ <strong className="mono" style={{ color: 'var(--red)' }}>{round.code}</strong> เพื่อยืนยัน:
          </div>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={round.code}
            autoFocus
            style={{
              width: '100%', height: 38, padding: '0 12px',
              border: `2px solid ${ok ? '#16a34a' : confirm ? 'var(--red)' : 'var(--line)'}`,
              borderRadius: 6, fontSize: 14, letterSpacing: '.05em', fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button
            onClick={submit}
            disabled={!ok || busy}
            style={{
              padding: '8px 18px', borderRadius: 6, fontWeight: 600, fontSize: 13,
              border: 'none', cursor: ok && !busy ? 'pointer' : 'not-allowed',
              background: ok ? 'var(--red)' : 'var(--bg-sunk)',
              color: ok ? '#fff' : 'var(--text-muted)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            🗑️ {busy ? 'กำลังลบ…' : 'ลบรอบนี้ถาวร'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Round header modal (draft only) ─────────────────────────────────────
function EditRoundModal({
  round, vehicles, employees, updateDispatch, onClose, onSaved,
}: {
  round: Dispatch
  vehicles: Vehicle[]
  employees: Employee[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDispatch: any
  onClose: () => void
  onSaved: () => void
}) {
  const drivers = employees.filter(e => e.position === 'คนขับ')
  const transportVehicles = vehicles
    .filter(v => v.groupKind === 'TRANSPORT')
    .sort((a, b) => a.plate.localeCompare(b.plate))

  const [form, setForm] = useState({
    depart: round.depart || (round.date + 'T08:00'),
    vehicleId: round.vehicleId ?? '',
    driverId: round.driverId ?? '',
    startOdometer: round.startOdometer != null ? String(round.startOdometer) : '',
    notes: round.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr('')
    if (!form.depart) return setErr('กรุณาระบุวันที่/เวลาออกเดินทาง')
    if (!form.vehicleId) return setErr('กรุณาเลือกรถ')
    if (!form.driverId) return setErr('กรุณาเลือกคนขับ')
    const startOdo = Number(form.startOdometer)
    if (form.startOdometer === '' || isNaN(startOdo) || startOdo < 0)
      return setErr('กรุณาระบุเลขไมล์ต้นรอบ')
    setBusy(true)
    try {
      await updateDispatch.mutateAsync({
        id: round.id,
        patch: {
          depart: form.depart,
          date: form.depart.slice(0, 10),
          vehicleId: form.vehicleId,
          driverId: form.driverId,
          startOdometer: startOdo,
          notes: form.notes,
        },
      })
      onSaved()
    } catch (e) {
      setErr('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="head"><h3>✏️ แก้ไขข้อมูลรอบ {round.code}</h3></div>
        <div className="body">
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{err}</div>
          )}
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันที่/เวลาออกเดินทาง *">
              <input
                type="datetime-local"
                value={form.depart}
                onChange={e => setForm(f => ({ ...f, depart: e.target.value }))}
              />
            </Field>
            <Field label="เลขไมล์ต้นรอบ (km) *">
              <input
                type="number"
                value={form.startOdometer}
                onChange={e => setForm(f => ({ ...f, startOdometer: e.target.value }))}
                placeholder="0"
              />
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label="ทะเบียนรถ *">
              <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                <option value="">— เลือกรถ —</option>
                {transportVehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} ({v.brand} · {v.type})</option>
                ))}
              </select>
            </Field>
            <Field label="คนขับ *">
              <select value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                <option value="">— เลือกคนขับ —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="หมายเหตุ">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </Field>
          </div>
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" onClick={save} disabled={busy}>
            <Icon name="check" size={14} /> {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Request-edit modal (employee, closed round) ─────────────────────────────
// More structured than the basic reason-only modal in DispatchSummaryReport:
// employee ticks which parts they want to fix so the admin sees the intent
// straight away on the approval card.
const EDITABLE_FIELDS: { key: string; label: string }[] = [
  { key: 'depart',      label: 'วันที่/เวลาออกเดินทาง' },
  { key: 'odometer',    label: 'เลขไมล์ต้น/ปลาย' },
  { key: 'vehicle',     label: 'ทะเบียนรถ' },
  { key: 'driver',      label: 'คนขับ' },
  { key: 'leg_weight',  label: 'น้ำหนัก/ราคา ของขา' },
  { key: 'fuel',        label: 'น้ำมัน (ลิตร/ราคา)' },
  { key: 'per_diem',    label: 'เบี้ยเลี้ยง' },
  { key: 'other_exp',   label: 'ค่าใช้จ่ายอื่น' },
  { key: 'notes',       label: 'หมายเหตุ' },
]

function RequestEditRoundModal({
  round, onClose, onSubmit,
}: {
  round: Dispatch
  onClose: () => void
  onSubmit: (fields: string[], reason: string) => Promise<void>
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const toggle = (k: string) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  const submit = async () => {
    setErr('')
    if (picked.size === 0) return setErr('กรุณาเลือกส่วนที่ต้องการแก้ไขอย่างน้อย 1 ข้อ')
    if (!reason.trim()) return setErr('กรุณากรอกเหตุผล')
    setBusy(true)
    try { await onSubmit([...picked], reason.trim()) } finally { setBusy(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="head"><h3>🔔 ขอแก้ไขรอบที่ปิดแล้ว</h3></div>
        <div className="body">
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{err}</div>
          )}
          <p style={{ marginBottom: 14, fontSize: 13 }}>
            รอบ <strong className="mono" style={{ color: 'var(--primary)' }}>{round.code}</strong> — แอดมินจะเห็นคำขอนี้ในแดชบอร์ดและพิจารณาเปิดรอบกลับให้แก้
          </p>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>ส่วนที่ต้องการแก้ *</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {EDITABLE_FIELDS.map(f => {
                const on = picked.has(f.key)
                return (
                  <label key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--primary)' : 'var(--line)'}`,
                    background: on ? 'var(--primary-50)' : '#fff',
                    fontSize: 13,
                  }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(f.key)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>{f.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <Field label="เหตุผล *">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="เช่น เลขไมล์ปลายผิด ใส่เกิน 100 km"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </Field>
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            <Icon name="check" size={14} /> {busy ? 'กำลังส่ง…' : 'ส่งคำขอ'}
          </button>
        </div>
      </div>
    </div>
  )
}
