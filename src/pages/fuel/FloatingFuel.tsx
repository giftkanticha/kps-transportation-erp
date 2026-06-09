import { useState } from 'react'
import { useList, useUpdate, useDelete } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { useAuth } from '../../context/AuthContext'
import { Icon, Field } from '../../components/ui'
import type { FuelTransaction, Vehicle, FuelRecord } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function thaiDate(iso: string) {
  const d = new Date(iso)
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'รอออกเดินทาง',
  'in-progress': 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FloatingFuel() {
  const { isManager, isAdmin } = useAuth()
  const [linkTx, setLinkTx]   = useState<FuelTransaction | null>(null)
  const [editTx, setEditTx]   = useState<FuelTransaction | null>(null)
  const [selectedDispatch, setSelectedDispatch] = useState('')

  const { data: allFuelTxs = [] }  = useList<FuelTransaction>('fuel_transactions')
  const { data: allFuelRecs = [] } = useList<FuelRecord>('fuel_records')
  const { data: allDispatches = [] } = useDispatches()
  const { data: vehicles = [] }     = useList<Vehicle>('vehicles')
  const updateFuelTx  = useUpdate<FuelTransaction>('fuel_transactions')
  const updateFuelRec = useUpdate<FuelRecord>('fuel_records')
  const deleteFuelTx  = useDelete('fuel_transactions')
  const deleteFuelRec = useDelete('fuel_records')

  const floatingTxs = [...allFuelTxs]
    .filter(t => t.status === 'FLOATING')
    .sort((a, b) => b.date.localeCompare(a.date))

  const openLinkModal = (tx: FuelTransaction) => {
    const candidates = allDispatches
      .filter(d => d.vehicleId === tx.vehicleId && d.status !== 'cancelled')
      .sort((a, b) =>
        Math.abs(new Date(a.date).getTime() - new Date(tx.date).getTime()) -
        Math.abs(new Date(b.date).getTime() - new Date(tx.date).getTime()),
      )
    setLinkTx(tx)
    setSelectedDispatch(candidates[0]?.id ?? '')
  }

  const doLink = async () => {
    if (!linkTx || !selectedDispatch) return
    try {
      await updateFuelTx.mutateAsync({
        id: linkTx.id,
        patch: { tripId: selectedDispatch, status: 'TRIP_LINKED' },
      })
      setLinkTx(null)
      setSelectedDispatch('')
    } catch (e) {
      alert('ผูกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Find the legacy fuel_records mirror for a tx (matched by date + vehicle +
  // liters since Express Fuel Log inserts to both tables but doesn't store an FK).
  const findMirror = (tx: FuelTransaction): FuelRecord | undefined =>
    allFuelRecs.find(r =>
      r.vehicleId === tx.vehicleId
      && r.date === tx.date
      && Math.abs(r.liters - tx.liters) < 0.01,
    )

  const saveEdit = async (patch: Partial<FuelTransaction>) => {
    if (!editTx) return
    try {
      await updateFuelTx.mutateAsync({ id: editTx.id, patch })
      const mirror = findMirror(editTx)
      if (mirror) {
        await updateFuelRec.mutateAsync({
          id: mirror.id,
          patch: {
            date: patch.date ?? mirror.date,
            vehicleId: patch.vehicleId ?? mirror.vehicleId,
            liters: patch.liters ?? mirror.liters,
            pricePerL: patch.pricePerL ?? mirror.pricePerL,
            total: patch.total ?? mirror.total,
            station: (patch.source ?? editTx.source) === 'FACTORY_TANK' ? 'ถังโรงงาน' : 'ปั๊มภายนอก',
          },
        })
      }
      setEditTx(null)
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const removeTx = async (tx: FuelTransaction) => {
    if (!confirm(`ลบรายการน้ำมันลอยนี้?\n${thaiDate(tx.date)} · ${fmt(tx.liters)} ลิตร`)) return
    try {
      await deleteFuelTx.mutateAsync(tx.id)
      const mirror = findMirror(tx)
      if (mirror) await deleteFuelRec.mutateAsync(mirror.id)
    } catch (e) {
      alert('ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  if (floatingTxs.length === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#166534' }}>ไม่มีน้ำมันลอย</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          รายการน้ำมันทั้งหมดได้รับการผูกรอบงานครบถ้วนแล้ว
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">🟡 น้ำมันลอย (Floating Fuel)</h1>
          <div className="page-sub">รายการที่ยังไม่ได้ผูกรอบงาน — กด "ผูกรอบ" เพื่อเชื่อมกับใบงาน{isAdmin && ' · แอดมินแก้ไข/ลบรายการได้'}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #FDE68A', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <div style={{
          padding: '12px 18px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#78350F' }}>⚠️ รายการน้ำมันลอย</span>
          <span style={{
            background: '#F59E0B', color: '#fff', borderRadius: 20,
            padding: '2px 10px', fontSize: 11, fontWeight: 700,
          }}>
            {floatingTxs.length} รายการ
          </span>
        </div>

        <div style={{ overflowX: 'auto', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
                {(isManager
                  ? ['วันที่', 'ทะเบียน', 'ลิตร', 'จำนวนเงิน', 'แหล่ง', 'รอบงานแนะนำ', '']
                  : ['วันที่', 'ทะเบียน', 'ลิตร', 'แหล่ง', 'รอบงานแนะนำ', '']
                ).map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 14px',
                    textAlign: i === 2 || (isManager && i === 3) ? 'right' : i === (isManager ? 6 : 5) ? 'center' : 'left',
                    color: '#78350F', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {floatingTxs.map((tx, i) => {
                const vehicle = vehicles.find(v => v.id === tx.vehicleId)
                const suggested = allDispatches
                  .filter(d => d.vehicleId === tx.vehicleId && d.status !== 'cancelled')
                  .sort((a, b) =>
                    Math.abs(new Date(a.date).getTime() - new Date(tx.date).getTime()) -
                    Math.abs(new Date(b.date).getTime() - new Date(tx.date).getTime()),
                  )[0]

                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #FEF3C7', background: i % 2 === 0 ? '#fff' : '#FFFDF5' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 500 }}>{thaiDate(tx.date)}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                        {vehicle?.plate ?? '—'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                        {vehicle?.brand}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {fmt(tx.liters)} ล.
                    </td>
                    {isManager && (
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmt(tx.total)} ฿
                      </td>
                    )}
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                        background: tx.source === 'FACTORY_TANK' ? '#EFF6FF' : '#FFF7ED',
                        color: tx.source === 'FACTORY_TANK' ? '#1D4ED8' : '#C2410C',
                      }}>
                        {tx.source === 'FACTORY_TANK' ? '🏭 ถังโรงงาน' : '⛽ ปั๊มนอก'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      {suggested ? (
                        <span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                            {suggested.code}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                            {thaiDate(suggested.date.slice(0, 10))}
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: '#CBD5E1', fontSize: 12 }}>ไม่มีรอบงาน</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => openLinkModal(tx)}
                          style={{
                            background: '#0066CC', color: '#fff', border: 'none',
                            borderRadius: 7, padding: '6px 16px', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#0052A3')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#0066CC')}
                        >
                          ผูกรอบ
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              className="btn ghost icon sm"
                              onClick={() => setEditTx(tx)}
                              title="แก้ไขรายการ"
                            >
                              <Icon name="edit" size={13} />
                            </button>
                            <button
                              className="btn ghost icon sm"
                              style={{ color: 'var(--red)' }}
                              onClick={() => void removeTx(tx)}
                              title="ลบรายการ"
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Link Modal */}
      {linkTx && (() => {
        const vehicle = vehicles.find(v => v.id === linkTx.vehicleId)
        const candidates = allDispatches
          .filter(d => d.vehicleId === linkTx.vehicleId && d.status !== 'cancelled')
          .sort((a, b) =>
            Math.abs(new Date(a.date).getTime() - new Date(linkTx.date).getTime()) -
            Math.abs(new Date(b.date).getTime() - new Date(linkTx.date).getTime()),
          )
          .slice(0, 12)

        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000,
          }}>
            <div style={{
              background: '#fff', borderRadius: 14, width: 500, maxHeight: '85vh',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Modal header */}
              <div style={{ padding: '16px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>🔗 ผูกน้ำมันเข้ารอบงาน</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setLinkTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9CA3AF', lineHeight: 1 }}>×</button>
              </div>

              <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
                {/* Tx summary */}
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, color: '#78350F', fontSize: 13 }}>น้ำมันที่จะผูก</div>
                  <div style={{ marginTop: 5, fontSize: 13, color: '#92400E' }}>
                    {thaiDate(linkTx.date)} · <strong>{vehicle?.plate ?? '—'}</strong> · {fmt(linkTx.liters)} ลิตร{isManager && ` · ${fmt(linkTx.total)} บาท`}
                  </div>
                </div>

                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>เลือกรอบงานที่จะผูก</div>

                {candidates.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px 0', fontSize: 13 }}>
                    ไม่พบรอบงานสำหรับรถคันนี้
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {candidates.map(d => {
                      const active = selectedDispatch === d.id
                      return (
                        <label
                          key={d.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                            border: `2px solid ${active ? '#0066CC' : '#E2E8F0'}`,
                            background: active ? '#EFF6FF' : '#fff',
                            transition: 'all .12s',
                          }}
                        >
                          <input
                            type="radio"
                            name="dispatch-sel"
                            value={d.id}
                            checked={active}
                            onChange={() => setSelectedDispatch(d.id)}
                            style={{ accentColor: '#0066CC', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{d.code}</div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                              {thaiDate(d.date.slice(0, 10))}
                              {d.legs?.[0] && ` · ${d.legs[0].origin} → ${d.legs[0].destination}`}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                            background: d.status === 'completed' ? '#F0FDF4' : d.status === 'in-progress' ? '#EFF6FF' : '#F8FAFC',
                            color: d.status === 'completed' ? '#166534' : d.status === 'in-progress' ? '#1D4ED8' : '#64748B',
                          }}>
                            {STATUS_LABEL[d.status] ?? d.status}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn" onClick={() => setLinkTx(null)}>ยกเลิก</button>
                <button
                  className="btn primary"
                  onClick={doLink}
                  disabled={!selectedDispatch}
                  style={{ opacity: selectedDispatch ? 1 : 0.45 }}
                >
                  ยืนยันผูกรอบ
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {editTx && (
        <EditTxModal
          tx={editTx}
          vehicles={vehicles}
          onClose={() => setEditTx(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  )
}

// ─── Admin edit modal ─────────────────────────────────────────────────────────

function EditTxModal({
  tx, vehicles, onClose, onSave,
}: {
  tx: FuelTransaction
  vehicles: Vehicle[]
  onClose: () => void
  onSave: (patch: Partial<FuelTransaction>) => Promise<void>
}) {
  const [form, setForm] = useState({
    date: tx.date,
    vehicleId: tx.vehicleId ?? '',
    liters: String(tx.liters),
    pricePerL: String(tx.pricePerL ?? ''),
    source: tx.source,
    note: tx.note ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))
  const liters = Number(form.liters) || 0
  const price  = Number(form.pricePerL) || 0
  const total  = liters * price

  const save = async () => {
    setErr('')
    if (liters <= 0) return setErr('ลิตรต้อง > 0')
    if (!form.vehicleId) return setErr('กรุณาเลือกรถ')
    setBusy(true)
    try {
      await onSave({
        date: form.date,
        vehicleId: form.vehicleId,
        liters,
        pricePerL: price,
        total,
        source: form.source,
        note: form.note,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="head"><h3>✏️ แก้ไขรายการน้ำมันลอย</h3></div>
        <div className="body">
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{err}</div>
          )}
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันที่ *">
              <input type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={e => set('date', e.target.value)} />
            </Field>
            <Field label="ทะเบียนรถ *">
              <select value={form.vehicleId} onChange={e => set('vehicleId', e.target.value)}>
                <option value="">— เลือกรถ —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} · {v.brand}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label="ลิตร *">
              <input type="number" step="0.01" value={form.liters} onChange={e => set('liters', e.target.value)} />
            </Field>
            <Field label="ราคา/ลิตร">
              <input type="number" step="0.01" value={form.pricePerL} onChange={e => set('pricePerL', e.target.value)} />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="แหล่งน้ำมัน">
              <select value={form.source} onChange={e => set('source', e.target.value as FuelTransaction['source'])}>
                <option value="FACTORY_TANK">🏭 ถังโรงงาน</option>
                <option value="EXTERNAL_PUMP">⛽ ปั๊มภายนอก</option>
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="หมายเหตุ">
              <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="—" />
            </Field>
          </div>
          {total > 0 && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--primary-50)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ยอดรวม</span>
              <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{fmt(total)} บาท</span>
            </div>
          )}
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
