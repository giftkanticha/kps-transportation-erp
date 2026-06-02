import { useState, useMemo } from 'react'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { useAuth } from '../../context/AuthContext'
import type { FuelDailyPrice } from '../../types'
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

export function FuelDailyPricesPage() {
  const { isManager, isAdmin } = useAuth()
  const { data: prices = [], isLoading } = useList<FuelDailyPrice>('fuel_daily_prices', 'date', false)
  const insertPrice = useInsert<FuelDailyPrice>('fuel_daily_prices')
  const updatePrice = useUpdate<FuelDailyPrice>('fuel_daily_prices')
  const deletePrice = useDelete('fuel_daily_prices')

  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<FuelDailyPrice | null>(null)

  // Factory tank only. External pump prices vary per station/province so
  // drivers always type from the receipt instead of pulling from a table.
  const factoryPrices = useMemo(
    () => prices.filter(p => p.source === 'FACTORY_TANK'),
    [prices],
  )

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
                          try { await deletePrice.mutateAsync(p.id) }
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
              await insertPrice.mutateAsync(row)
              setShowAdd(false)
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
              setEditing(null)
            } catch (e) {
              alert('บันทึกไม่สำเร็จ: ' + (e as Error).message)
            }
          }}
        />
      )}
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
