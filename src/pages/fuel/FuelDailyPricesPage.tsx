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

  const [filterSource, setFilterSource] = useState<'ALL' | 'EXTERNAL_PUMP' | 'FACTORY_TANK'>('ALL')
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<FuelDailyPrice | null>(null)

  const filtered = useMemo(() => {
    return prices
      .filter(p => filterSource === 'ALL' || p.source === filterSource)
      .filter(p => !filterMonth || p.date.startsWith(filterMonth))
      .sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source))
  }, [prices, filterSource, filterMonth])

  // Latest known price for each source (used as the "current" headline above)
  const latestExternal = useMemo(() => priceForDate(prices, 'EXTERNAL_PUMP', new Date().toISOString().slice(0, 10)), [prices])
  const latestFactory  = useMemo(() => priceForDate(prices, 'FACTORY_TANK',  new Date().toISOString().slice(0, 10)), [prices])

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
          <h1 className="page-title">ราคาน้ำมันรายวัน</h1>
          <div className="page-sub">
            ตั้งราคาน้ำมัน (บาท/ลิตร) ต่อวัน · ใช้ใน "คีย์ด่วนน้ำมัน" อัตโนมัติ · พนักงานไม่ต้องกรอกเอง
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={15} /> ตั้งราคาวันใหม่
          </button>
        </div>
      </div>

      {/* Current price headlines */}
      <div className="grid-2" style={{ gap: 14, marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">🟠 ปั๊มภายนอก — ราคาล่าสุด</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: latestExternal != null ? 'var(--text)' : 'var(--text-muted)' }}>
            {latestExternal != null ? latestExternal.toFixed(2) : '—'}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>บาท/ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">🟢 ถังโรงงาน — ราคาล่าสุด</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: latestFactory != null ? 'var(--text)' : 'var(--text-muted)' }}>
            {latestFactory != null ? latestFactory.toFixed(2) : '—'}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>บาท/ลิตร</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad" style={{ marginBottom: 14, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Field label="เดือน">
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 160 }} />
        </Field>
        <Field label="แหล่งน้ำมัน">
          <select value={filterSource} onChange={e => setFilterSource(e.target.value as typeof filterSource)} style={{ width: 200 }}>
            <option value="ALL">ทั้งหมด</option>
            <option value="EXTERNAL_PUMP">🟠 ปั๊มภายนอก</option>
            <option value="FACTORY_TANK">🟢 ถังโรงงาน</option>
          </select>
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
              <th style={{ width: 170 }}>แหล่งน้ำมัน</th>
              <th className="num right" style={{ width: 140 }}>ราคา/ลิตร</th>
              <th>หมายเหตุ</th>
              <th style={{ width: 100 }}>กำหนดเมื่อ</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center' }}>กำลังโหลด…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: 'var(--text-2)' }}>
                ยังไม่มีรายการในเดือนนี้ — กด "ตั้งราคาวันใหม่" เพื่อเพิ่ม
              </td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id}>
                <td className="mono">{db.thaiDate(p.date)}</td>
                <td>
                  {p.source === 'EXTERNAL_PUMP' ? (
                    <span className="badge" style={{ background: '#FFF7ED', color: '#C2410C', fontSize: 11.5 }}>🟠 ปั๊มภายนอก</span>
                  ) : (
                    <span className="badge" style={{ background: '#F0FDF4', color: '#166534', fontSize: 11.5 }}>🟢 ถังโรงงาน</span>
                  )}
                </td>
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
    source: (existing?.source ?? 'EXTERNAL_PUMP') as 'EXTERNAL_PUMP' | 'FACTORY_TANK',
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
        source: form.source,
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
          <h3>{existing ? '✏️ แก้ไขราคาน้ำมัน' : '💰 ตั้งราคาน้ำมันใหม่'}</h3>
        </div>
        <div className="body">
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{err}</div>
          )}
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันที่ *">
              <input type="date" value={form.date} max={today} onChange={e => set('date', e.target.value)} />
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                ราคาจะใช้กับการเติมตั้งแต่วันนี้เป็นต้นไป จนกว่าจะมีราคาวันใหม่
              </div>
            </Field>
            <Field label="แหล่งน้ำมัน *">
              <select value={form.source} onChange={e => set('source', e.target.value as 'EXTERNAL_PUMP' | 'FACTORY_TANK')}>
                <option value="EXTERNAL_PUMP">🟠 ปั๊มภายนอก</option>
                <option value="FACTORY_TANK">🟢 ถังโรงงาน</option>
              </select>
            </Field>
          </div>
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
