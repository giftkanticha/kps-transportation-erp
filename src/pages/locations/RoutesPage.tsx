import { useState, useMemo } from 'react'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { Icon, Field, StatusBadge, SearchInput } from '../../components/ui'
import { db } from '../../lib/db'
import type { Location, Route } from '../../types'

interface RouteForm {
  originLocationId: string
  destinationLocationId: string
  standardDistanceKm: string
  standardKmpl: string
  notes: string
}

const EMPTY: RouteForm = { originLocationId: '', destinationLocationId: '', standardDistanceKm: '', standardKmpl: '', notes: '' }

// ใช้ชื่อ+ที่อยู่+จังหวัดที่มีอยู่แล้วในทะเบียนสถานที่ ประกอบเป็นคำค้นหาให้ Google Maps
// เดาพิกัดเอง — ไม่ต้องผูก API/พิกัดจริง แค่เปิดดูระยะทางจริงแล้วพิมพ์ใส่เอง
function mapsQueryFor(l?: Location): string {
  if (!l) return ''
  return [l.name, l.address, l.province].filter(Boolean).join(', ')
}

function mapsDirectionsUrl(origin?: Location, destination?: Location): string | null {
  const o = mapsQueryFor(origin)
  const d = mapsQueryFor(destination)
  if (!o || !d) return null
  const params = new URLSearchParams({ api: '1', origin: o, destination: d, travelmode: 'driving' })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function Modal({
  open, onClose, title, footer, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  footer: React.ReactNode
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, width: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <div style={{ flex: 1 }} />
          <button className="btn ghost icon sm" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

export function RoutesPage() {
  const [q, setQ] = useState('')
  const [show, setShow] = useState(false)
  const [editRoute, setEditRoute] = useState<Route | null>(null)
  const [form, setForm] = useState<RouteForm>(EMPTY)
  const [busy, setBusy] = useState(false)

  const { data: locations = [] } = useList<Location>('locations')
  const { data: routes = [] } = useList<Route>('routes')
  const insertRoute = useInsert<Route>('routes')
  const updateRoute = useUpdate<Route>('routes')
  const deleteRoute = useDelete('routes')

  const activeLocations = useMemo(
    () => locations.filter(l => l.active).sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [locations],
  )
  const locationById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations])
  const nameOf = (id: string) => locationById.get(id)?.name ?? '—'

  const rows = useMemo(() => {
    const arr = [...routes].sort((a, b) => nameOf(a.originLocationId).localeCompare(nameOf(b.originLocationId), 'th'))
    if (!q) return arr
    const qq = q.toLowerCase()
    return arr.filter(r =>
      nameOf(r.originLocationId).toLowerCase().includes(qq) ||
      nameOf(r.destinationLocationId).toLowerCase().includes(qq),
    )
  }, [routes, q, locationById])

  const openCreate = () => { setEditRoute(null); setForm(EMPTY); setShow(true) }
  const openEdit = (r: Route) => {
    setEditRoute(r)
    setForm({
      originLocationId: r.originLocationId,
      destinationLocationId: r.destinationLocationId,
      standardDistanceKm: r.standardDistanceKm != null ? String(r.standardDistanceKm) : '',
      standardKmpl: r.standardKmpl != null ? String(r.standardKmpl) : '',
      notes: r.notes ?? '',
    })
    setShow(true)
  }

  const save = async () => {
    if (!form.originLocationId || !form.destinationLocationId) {
      alert('กรุณาเลือกต้นทางและปลายทาง'); return
    }
    if (form.originLocationId === form.destinationLocationId) {
      alert('ต้นทางและปลายทางต้องไม่ใช่ที่เดียวกัน'); return
    }
    if (busy) return
    const clash = routes.find(r =>
      r.originLocationId === form.originLocationId &&
      r.destinationLocationId === form.destinationLocationId &&
      r.id !== editRoute?.id,
    )
    if (clash) { alert('มีเส้นทางนี้ (ต้นทาง→ปลายทางเดียวกัน) อยู่แล้ว — แก้ไขรายการเดิมแทน'); return }

    const fields = {
      originLocationId: form.originLocationId,
      destinationLocationId: form.destinationLocationId,
      standardDistanceKm: form.standardDistanceKm.trim() ? Number(form.standardDistanceKm) : null,
      standardKmpl: form.standardKmpl.trim() ? Number(form.standardKmpl) : null,
      notes: form.notes,
    }
    setBusy(true)
    try {
      if (editRoute) {
        await updateRoute.mutateAsync({ id: editRoute.id, patch: fields })
      } else {
        await insertRoute.mutateAsync({ ...fields, active: true })
      }
      setShow(false); setForm(EMPTY); setEditRoute(null)
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setBusy(false) }
  }

  const toggleActive = (r: Route) => updateRoute.mutate({ id: r.id, patch: { active: !r.active } })
  const remove = async (r: Route) => {
    if (!confirm(`ลบเส้นทาง "${nameOf(r.originLocationId)} → ${nameOf(r.destinationLocationId)}" ?`)) return
    try {
      await deleteRoute.mutateAsync(r.id)
    } catch (e) {
      alert('ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการเส้นทางมาตรฐาน</h1>
          <div className="page-sub">
            ตั้งระยะทาง/อัตราน้ำมันมาตรฐานต่อเส้นทาง — ใช้เป็นค่าอ้างอิงตอนที่เส้นทางยังมีเที่ยวย้อนหลังไม่พอ (ระบบยังคำนวณจากสถิติย้อนหลังก่อนเสมอถ้ามีพอ)
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openCreate}>
            <Icon name="plus" size={15} /> เพิ่มเส้นทางใหม่
          </button>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="ค้นหาต้นทาง / ปลายทาง..." width={280} />
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>ต้นทาง</th>
              <th>ปลายทาง</th>
              <th className="num">ระยะทางมาตรฐาน (กม.)</th>
              <th className="num">อัตรามาตรฐาน (กม./ลิตร)</th>
              <th>หมายเหตุ</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const mapsUrl = mapsDirectionsUrl(locationById.get(r.originLocationId), locationById.get(r.destinationLocationId))
              return (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                <td>{nameOf(r.originLocationId)}</td>
                <td>{nameOf(r.destinationLocationId)}</td>
                <td className="num">{r.standardDistanceKm != null ? db.fmt(r.standardDistanceKm) : <span className="muted">—</span>}</td>
                <td className="num">{r.standardKmpl != null ? r.standardKmpl.toFixed(2) : <span className="muted">—</span>}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>{r.notes || '—'}</td>
                <td><StatusBadge status={r.active ? 'active' : 'inactive'} /></td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    {mapsUrl && (
                      <a
                        className="btn ghost sm"
                        title="เปิดดูระยะทางจริงใน Google Maps"
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="pin" size={13} /> Maps
                      </a>
                    )}
                    <button className="btn ghost icon sm" title="แก้ไข" onClick={() => openEdit(r)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="btn ghost sm" title={r.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} onClick={() => toggleActive(r)}>
                      {r.active ? 'ปิดใช้' : 'เปิดใช้'}
                    </button>
                    <button className="btn ghost sm" title="ลบ" onClick={() => remove(r)}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty" style={{ padding: 32 }}>ยังไม่มีเส้นทาง — กด "เพิ่มเส้นทางใหม่"</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={show}
        onClose={() => !busy && setShow(false)}
        title={editRoute ? 'แก้ไขเส้นทาง' : 'เพิ่มเส้นทางใหม่'}
        footer={
          <>
            <button className="btn" onClick={() => setShow(false)} disabled={busy}>ยกเลิก</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </>
        }
      >
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="ต้นทาง *">
            <select value={form.originLocationId} onChange={e => setForm(f => ({ ...f, originLocationId: e.target.value }))}>
              <option value="">— เลือกต้นทาง —</option>
              {activeLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="ปลายทาง *">
            <select value={form.destinationLocationId} onChange={e => setForm(f => ({ ...f, destinationLocationId: e.target.value }))}>
              <option value="">— เลือกปลายทาง —</option>
              {activeLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        {(() => {
          const mapsUrl = mapsDirectionsUrl(locationById.get(form.originLocationId), locationById.get(form.destinationLocationId))
          if (mapsUrl) {
            return (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, marginTop: 12, color: 'var(--primary)' }}
              >
                <Icon name="pin" size={13} /> เปิดดูระยะทางจริงใน Google Maps ↗
              </a>
            )
          }
          // ยังไม่ขึ้นลิงก์เพราะยังเลือกไม่ครบ — บอกให้ชัดแทนการไม่แสดงอะไรเลย
          // (ผู้ใช้เข้าใจผิดว่าฟีเจอร์หายไปถ้าไม่มีข้อความอะไรตรงนี้เลย)
          return (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
              <Icon name="pin" size={13} /> เลือกต้นทางและปลายทางให้ครบก่อน จะมีลิงก์เปิดดูระยะทางจริงใน Google Maps ขึ้นตรงนี้
              {activeLocations.length === 0 && <> — ตอนนี้ทะเบียนสถานที่ยังไม่มีรายการ (ไม่มีตัวเลือกในช่องด้านบน) ต้องไปเพิ่มที่ "ทะเบียนสถานที่" ก่อน</>}
            </div>
          )
        })()}
        <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
          <Field label="ระยะทางมาตรฐาน (กม.)">
            <input type="number" step="0.1" value={form.standardDistanceKm} onChange={e => setForm(f => ({ ...f, standardDistanceKm: e.target.value }))} placeholder="เช่น 85" />
          </Field>
          <Field label="อัตรามาตรฐาน (กม./ลิตร)">
            <input type="number" step="0.01" value={form.standardKmpl} onChange={e => setForm(f => ({ ...f, standardKmpl: e.target.value }))} placeholder="เช่น 3.2" />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="หมายเหตุ">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', resize: 'vertical' }} />
          </Field>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          💡 เว้นว่างช่องไหนได้ถ้ายังไม่รู้ค่า — ระบบจะใช้ค่าเฉลี่ยจากเที่ยวย้อนหลังแทนถ้ามีเที่ยวพอ (≥3 เที่ยว) และใช้ค่าที่ตั้งไว้นี้เมื่อยังไม่มีประวัติพอ
        </div>
      </Modal>
    </div>
  )
}
