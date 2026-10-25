import { useState, useMemo } from 'react'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { useAuth } from '../../context/AuthContext'
import type { FuelDailyPrice, FuelRecord, FuelTransaction } from '../../types'
import { Icon, Field } from '../../components/ui'
import { db } from '../../lib/db'

// Returns the most recent price <= the given ISO date, or null.
export function priceForDate(
  prices: FuelDailyPrice[],
  source: 'EXTERNAL_PUMP' | 'FACTORY_TANK',
  date: string,
): number | null {
  const candidates = prices
    .filter(p => p.source === source && p.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))
  return candidates[0]?.pricePerL ?? null
}

const round2 = (n: number) => Math.round(n * 100) / 100

// A single already-keyed factory-tank fill whose stored price no longer
// matches the daily price table (e.g. after a price was backdated).
export interface PriceDiff {
  id: string
  date: string
  liters: number
  oldPrice: number
  newPrice: number
  oldTotal: number
  newTotal: number
}

// Compares each row's stored pricePerL against the daily factory-tank price
// effective on its fill date, returning only the rows that need repricing.
// Pure + exported so it can be unit-tested independently of the UI.
export function factoryRepricingDiffs(
  rows: { id: string; date: string; liters: number; pricePerL: number; total: number }[],
  prices: FuelDailyPrice[],
): PriceDiff[] {
  const out: PriceDiff[] = []
  for (const r of rows) {
    const correct = priceForDate(prices, 'FACTORY_TANK', r.date)
    if (correct == null) continue                       // no price applies yet — leave as keyed
    if (Math.abs(correct - r.pricePerL) < 0.0001) continue
    const newTotal = round2((r.liters || 0) * correct)
    out.push({
      id: r.id,
      date: r.date,
      liters: r.liters || 0,
      oldPrice: r.pricePerL,
      newPrice: correct,
      oldTotal: r.total ?? round2((r.liters || 0) * r.pricePerL),
      newTotal,
    })
  }
  return out
}

export function FuelDailyPricesPage() {
  const { isManager, isAdmin } = useAuth()
  const { data: prices = [], isLoading } = useList<FuelDailyPrice>('fuel_daily_prices', 'date', false)
  const { data: fuelRecords = [] } = useList<FuelRecord>('fuel_records')
  const { data: fuelTxs = [] } = useList<FuelTransaction>('fuel_transactions')
  const insertPrice = useInsert<FuelDailyPrice>('fuel_daily_prices')
  const updatePrice = useUpdate<FuelDailyPrice>('fuel_daily_prices')
  const deletePrice = useDelete('fuel_daily_prices')
  const updateFuelRec = useUpdate<FuelRecord>('fuel_records')
  const updateFuelTx = useUpdate<FuelTransaction>('fuel_transactions')

  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<FuelDailyPrice | null>(null)
  const [showReprice, setShowReprice] = useState(false)

  // Factory tank only. External pump prices vary per station/province so
  // drivers always type from the receipt instead of pulling from a table.
  const factoryPrices = useMemo(
    () => prices.filter(p => p.source === 'FACTORY_TANK'),
    [prices],
  )

  // Already-keyed factory-tank fills whose stored price no longer matches the
  // daily price table. We look at both fuel_records (station 'ถังโรงงาน') and
  // fuel_transactions (source FACTORY_TANK, excluding reversed ones). External
  // pump fills are never touched — drivers type those from the receipt.
  // Computed against an explicit prices array so the same logic serves both the
  // live display and the post-save decision (the React-Query cache hasn't
  // refetched yet at the moment a save resolves).
  const diffsFor = (pricesArr: FuelDailyPrice[]) => ({
    recDiffs: factoryRepricingDiffs(fuelRecords.filter(r => r.station === 'ถังโรงงาน'), pricesArr),
    txDiffs: factoryRepricingDiffs(
      fuelTxs.filter(t => t.source === 'FACTORY_TANK' && t.status !== 'REVERSED'),
      pricesArr,
    ),
  })

  const { recDiffs, txDiffs } = useMemo(() => diffsFor(prices), [fuelRecords, fuelTxs, prices])
  const diffCount = recDiffs.length + txDiffs.length

  // After a price is added / edited / deleted, prompt to reprice past fills if
  // anything now disagrees with the table. `nextPrices` projects the change so
  // we don't depend on the cache having refetched yet.
  const offerReprice = (nextPrices: FuelDailyPrice[]) => {
    const { recDiffs: r, txDiffs: t } = diffsFor(nextPrices)
    if (r.length + t.length > 0) setShowReprice(true)
  }

  const applyReprice = async () => {
    for (const d of recDiffs) {
      await updateFuelRec.mutateAsync({ id: d.id, patch: { pricePerL: d.newPrice, total: d.newTotal } })
    }
    for (const d of txDiffs) {
      await updateFuelTx.mutateAsync({ id: d.id, patch: { pricePerL: d.newPrice, total: d.newTotal } })
    }
    setShowReprice(false)
  }

  const filtered = useMemo(() => {
    return factoryPrices
      .filter(p => !filterMonth || p.date.startsWith(filterMonth))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [factoryPrices, filterMonth])

  // Latest known factory-tank price (the headline above)
  const latestFactory = useMemo(
    () => priceForDate(factoryPrices, 'FACTORY_TANK', new Date().toISOString().slice(0, 10)),
    [factoryPrices],
  )

  if (!isManager) {
    return (
      <div className="empty" style={{ padding: 48 }}>
        เฉพาะผู้จัดการขึ้นไปเท่านั้นที่เข้าหน้านี้ได้
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ราคาน้ำมันโรงงานรายวัน</h1>
          <div className="page-sub">
            ตั้งราคาน้ำมัน <strong>ถังโรงงาน</strong> (บาท/ลิตร) ต่อวัน · ใช้ใน "คีย์ด่วนน้ำมัน" อัตโนมัติ
            <br />
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              💡 ปั๊มภายนอก — ราคาขึ้นกับปั๊ม/จังหวัด พนักงานกรอกตามใบเสร็จเองทุกครั้ง
            </span>
          </div>
        </div>
        <div className="actions">
          {diffCount > 0 && (
            <button className="btn" onClick={() => setShowReprice(true)} title="ปรับราคารายการเติมที่คีย์ไว้แล้วให้ตรงกับตารางราคา">
              <Icon name="refresh" size={15} /> อัปเดตราคาย้อนหลัง ({diffCount})
            </button>
          )}
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={15} /> ตั้งราคาวันใหม่
          </button>
        </div>
      </div>

      {/* Current price headline */}
      <div className="card kpi" style={{ marginBottom: 18, maxWidth: 380 }}>
        <div className="label">🟢 ถังโรงงาน — ราคาล่าสุด</div>
        <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: latestFactory != null ? 'var(--text)' : 'var(--text-muted)' }}>
          {latestFactory != null ? latestFactory.toFixed(2) : '—'}
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>บาท/ลิตร</span>
        </div>
      </div>

      {/* Filter */}
      <div className="card pad" style={{ marginBottom: 14, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Field label="เดือน">
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 160 }} />
        </Field>
        <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>
          {filtered.length} รายการ
        </div>
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 130 }}>วันที่</th>
              <th className="num right" style={{ width: 140 }}>ราคา/ลิตร</th>
              <th>หมายเหตุ</th>
              <th style={{ width: 100 }}>กำหนดเมื่อ</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' }}>กำลังโหลด…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 36, textAlign: 'center', color: 'var(--text-2)' }}>
                ยังไม่มีรายการในเดือนนี้ — กด "ตั้งราคาวันใหม่" เพื่อเพิ่ม
              </td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id}>
                <td className="mono">{db.thaiDate(p.date)}</td>
                <td className="num right mono" style={{ fontWeight: 600 }}>{p.pricePerL.toFixed(2)}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>{p.notes || '—'}</td>
                <td className="muted" style={{ fontSize: 11 }}>
                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="btn ghost icon sm" onClick={() => setEditing(p)} title="แก้ไข">
                      <Icon name="edit" size={13} />
                    </button>
                    {isAdmin && (
                      <button
                        className="btn ghost icon sm"
                        style={{ color: 'var(--red)' }}
                        onClick={async () => {
                          if (!confirm(`ลบราคาวันที่ ${db.thaiDate(p.date)} ?`)) return
                          try {
                            await deletePrice.mutateAsync(p.id)
                            offerReprice(prices.filter(x => x.id !== p.id))
                          }
                          catch (e) { alert('ลบไม่สำเร็จ: ' + (e as Error).message) }
                        }}
                        title="ลบ"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <PriceModal
          existing={null}
          onClose={() => setShowAdd(false)}
          onSave={async (row) => {
            try {
              const created = await insertPrice.mutateAsync(row)
              setShowAdd(false)
              offerReprice([...prices, created as FuelDailyPrice])
            } catch (e) {
              alert('บันทึกไม่สำเร็จ: ' + (e as Error).message)
            }
          }}
        />
      )}
      {editing && (
        <PriceModal
          existing={editing}
          onClose={() => setEditing(null)}
          onSave={async (row) => {
            try {
              await updatePrice.mutateAsync({ id: editing.id, patch: row })
              const id = editing.id
              setEditing(null)
              offerReprice(prices.map(p => p.id === id ? { ...p, ...row } : p))
            } catch (e) {
              alert('บันทึกไม่สำเร็จ: ' + (e as Error).message)
            }
          }}
        />
      )}
      {showReprice && (
        <RepriceModal
          recDiffs={recDiffs}
          txDiffs={txDiffs}
          busy={updateFuelRec.isPending || updateFuelTx.isPending}
          onApply={applyReprice}
          onClose={() => setShowReprice(false)}
        />
      )}
    </div>
  )
}

// Preview + confirm dialog for repricing already-keyed factory-tank fills.
function RepriceModal({
  recDiffs, txDiffs, busy, onApply, onClose,
}: {
  recDiffs: PriceDiff[]
  txDiffs: PriceDiff[]
  busy: boolean
  onApply: () => void
  onClose: () => void
}) {
  // De-dupe for the preview: a fill keyed via Express has a row in both tables
  // with the same date/liters/price, which would otherwise show twice.
  const seen = new Set<string>()
  const preview = [...recDiffs, ...txDiffs].filter(d => {
    const k = `${d.date}|${d.liters}|${d.oldPrice}|${d.newPrice}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).sort((a, b) => a.date.localeCompare(b.date))

  const count = recDiffs.length + txDiffs.length
  const totalDelta = round2([...recDiffs, ...txDiffs].reduce((s, d) => s + (d.newTotal - d.oldTotal), 0))

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="head">
          <h3>🔄 อัปเดตราคาน้ำมันย้อนหลัง</h3>
        </div>
        <div className="body">
          {count === 0 ? (
            <div className="empty" style={{ padding: 24, textAlign: 'center' }}>
              ✓ ทุกรายการเติม (ถังโรงงาน) ตรงกับตารางราคาอยู่แล้ว ไม่มีอะไรต้องปรับ
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-2)' }}>
                พบรายการเติม <strong>ถังโรงงาน</strong> ที่ราคาไม่ตรงกับตารางราคา <strong>{count}</strong> รายการ
                — ระบบจะปรับ <strong>ราคา/ลิตร</strong> และ <strong>ยอดรวม</strong> ให้ตรงกับราคา ณ วันที่เติม
                <br />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  💡 เฉพาะถังโรงงานเท่านั้น · ปั๊มภายนอกไม่ถูกแตะ (กรอกตามใบเสร็จ)
                </span>
              </div>
              <div className="tbl-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>วันที่</th>
                      <th className="num right">ลิตร</th>
                      <th className="num right">ราคาเดิม</th>
                      <th className="num right">ราคาใหม่</th>
                      <th className="num right">ยอดเดิม</th>
                      <th className="num right">ยอดใหม่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((d, i) => (
                      <tr key={i}>
                        <td className="mono">{db.thaiDate(d.date)}</td>
                        <td className="num right mono">{d.liters.toLocaleString()}</td>
                        <td className="num right mono" style={{ color: 'var(--text-muted)' }}>{d.oldPrice.toFixed(2)}</td>
                        <td className="num right mono" style={{ fontWeight: 600 }}>{d.newPrice.toFixed(2)}</td>
                        <td className="num right mono" style={{ color: 'var(--text-muted)' }}>{d.oldTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="num right mono" style={{ fontWeight: 600 }}>{d.newTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, textAlign: 'right' }}>
                ผลต่างยอดรวมสุทธิ:{' '}
                <strong className="mono" style={{ color: totalDelta >= 0 ? 'var(--red)' : 'var(--green, #166534)' }}>
                  {totalDelta >= 0 ? '+' : ''}{totalDelta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                </strong>
              </div>
            </>
          )}
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>{count === 0 ? 'ปิด' : 'ยกเลิก'}</button>
          {count > 0 && (
            <button className="btn primary" onClick={onApply} disabled={busy}>
              <Icon name="check" size={14} /> {busy ? 'กำลังปรับ…' : `ปรับ ${count} รายการ`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PriceModal({
  existing, onClose, onSave,
}: {
  existing: FuelDailyPrice | null
  onClose: () => void
  onSave: (row: Partial<FuelDailyPrice>) => Promise<void>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: existing?.date ?? today,
    pricePerL: existing?.pricePerL != null ? String(existing.pricePerL) : '',
    notes: existing?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setErr('')
    const price = Number(form.pricePerL)
    if (!form.date) return setErr('กรุณาเลือกวันที่')
    if (!(price > 0)) return setErr('ราคา/ลิตรต้อง > 0')
    setBusy(true)
    try {
      await onSave({
        date: form.date,
        source: 'FACTORY_TANK',
        pricePerL: price,
        notes: form.notes.trim(),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="head">
          <h3>{existing ? '✏️ แก้ไขราคาน้ำมันโรงงาน' : '💰 ตั้งราคาน้ำมันโรงงานใหม่'}</h3>
        </div>
        <div className="body">
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{err}</div>
          )}
          <Field label="วันที่ *">
            <input type="date" value={form.date} max={today} onChange={e => set('date', e.target.value)} />
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              ราคานี้จะใช้กับการเติมตั้งแต่วันนี้เป็นต้นไป จนกว่าจะมีราคาวันใหม่
            </div>
          </Field>
          <div style={{ marginTop: 14 }}>
            <Field label="ราคา/ลิตร (บาท) *">
              <input
                type="number"
                step="0.01"
                value={form.pricePerL}
                onChange={e => set('pricePerL', e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="หมายเหตุ">
              <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="เช่น ขึ้นราคา 0.50 บาท" />
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
