import React, { useState, useMemo } from 'react'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { Icon, Field, StatusBadge, SearchInput } from '../../components/ui'
import type { Location, DispatchLeg } from '../../types'

interface LocationForm {
  name: string
  category: string
  province: string
  address: string
  notes: string
}

const EMPTY: LocationForm = { name: '', category: '', province: '', address: '', notes: '' }

// แต่ละแถว = ชื่อสถานที่ที่ใช้จริง (จากทะเบียน ∪ ที่พิมพ์ไว้ในงาน) พร้อมจำนวนขาที่ใช้
interface Row {
  name: string
  master?: Location
  usage: number
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
        style={{ background: '#fff', borderRadius: 12, width: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}
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

export function LocationsPage() {
  const [q, setQ] = useState('')
  const [show, setShow] = useState(false)
  const [editRow, setEditRow] = useState<Row | null>(null)        // null = สร้างใหม่
  const [form, setForm] = useState<LocationForm>(EMPTY)
  const [mergeRow, setMergeRow] = useState<Row | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: locations = [] } = useList<Location>('locations')
  const { data: dispatches = [] } = useDispatches()
  const insertLocation = useInsert<Location>('locations')
  const updateLocation = useUpdate<Location>('locations')
  const deleteLocation = useDelete('locations')
  const updateLeg = useUpdate<DispatchLeg>('dispatch_legs')

  const allLegs = useMemo(() => dispatches.flatMap(d => d.legs ?? []), [dispatches])

  // จำนวนขาที่ใช้ชื่อแต่ละชื่อ (นับขาที่มีชื่อนี้เป็นต้นทางหรือปลายทาง)
  const legUsage = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of allLegs) {
      const names = new Set<string>()
      if (l.origin) names.add(l.origin)
      if (l.destination) names.add(l.destination)
      for (const n of names) m.set(n, (m.get(n) ?? 0) + 1)
    }
    return m
  }, [allLegs])

  const masterByName = useMemo(() => {
    const m = new Map<string, Location>()
    for (const loc of locations) m.set(loc.name, loc)
    return m
  }, [locations])

  const rows = useMemo<Row[]>(() => {
    const names = new Set<string>()
    locations.forEach(l => names.add(l.name))
    legUsage.forEach((_, n) => names.add(n))
    const arr: Row[] = [...names].map(n => ({ name: n, master: masterByName.get(n), usage: legUsage.get(n) ?? 0 }))
    const filtered = arr.filter(r =>
      !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.master?.province ?? '').toLowerCase().includes(q.toLowerCase()),
    )
    filtered.sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name, 'th'))
    return filtered
  }, [locations, legUsage, masterByName, q])

  const orphanCount = rows.filter(r => !r.master).length

  // เปลี่ยนชื่อในงานทุกขาที่ใช้ชื่อเดิม (ทั้งต้นทาง/ปลายทาง) → ชื่อใหม่
  const renameInLegs = async (oldName: string, newName: string) => {
    for (const l of allLegs) {
      if (!l.id) continue
      const patch: Partial<DispatchLeg> = {}
      if (l.origin === oldName) patch.origin = newName
      if (l.destination === oldName) patch.destination = newName
      if (Object.keys(patch).length) await updateLeg.mutateAsync({ id: l.id, patch })
    }
  }

  const openCreate = () => { setEditRow(null); setForm(EMPTY); setShow(true) }
  const openEdit = (r: Row) => {
    setEditRow(r)
    setForm({
      name: r.name,
      category: r.master?.category ?? '',
      province: r.master?.province ?? '',
      address: r.master?.address ?? '',
      notes: r.master?.notes ?? '',
    })
    setShow(true)
  }

  const save = async () => {
    const newName = form.name.trim()
    if (!newName) { alert('กรุณากรอกชื่อสถานที่'); return }
    if (busy) return

    // แก้ไขของเดิม
    if (editRow) {
      const oldName = editRow.name
      if (newName !== oldName) {
        const clash = masterByName.get(newName)
        if ((clash && clash.id !== editRow.master?.id) || legUsage.has(newName)) {
          alert(`มีชื่อ “${newName}” อยู่แล้ว — ถ้าต้องการรวมให้เป็นชื่อเดียวกัน ใช้ปุ่ม “รวม” แทน`)
          return
        }
      }
      setBusy(true)
      try {
        if (newName !== oldName) await renameInLegs(oldName, newName)
        if (editRow.master) {
          await updateLocation.mutateAsync({ id: editRow.master.id, patch: { name: newName, category: form.category, province: form.province, address: form.address, notes: form.notes } })
        } else {
          await insertLocation.mutateAsync({ name: newName, category: form.category, province: form.province, address: form.address, notes: form.notes, active: true })
        }
        setShow(false); setForm(EMPTY); setEditRow(null)
      } catch (e) {
        alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
      } finally { setBusy(false) }
      return
    }

    // สร้างใหม่
    setBusy(true)
    try {
      await insertLocation.mutateAsync({ name: newName, category: form.category, province: form.province, address: form.address, notes: form.notes, active: true })
      setShow(false); setForm(EMPTY)
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setBusy(false) }
  }

  const openMerge = (r: Row) => {
    setMergeRow(r)
    setMergeTarget('')
  }

  const doMerge = async () => {
    if (!mergeRow || !mergeTarget || busy) return
    if (mergeTarget === mergeRow.name) { alert('เลือกชื่อปลายทางที่ต่างจากชื่อนี้'); return }
    setBusy(true)
    try {
      await renameInLegs(mergeRow.name, mergeTarget)
      // ให้แน่ใจว่าชื่อปลายทางอยู่ในทะเบียน
      if (!masterByName.has(mergeTarget)) {
        await insertLocation.mutateAsync({ name: mergeTarget, category: '', province: '', address: '', notes: '', active: true })
      }
      // ลบทะเบียนชื่อเดิม (ถ้ามี)
      if (mergeRow.master) await deleteLocation.mutateAsync(mergeRow.master.id)
      setMergeRow(null); setMergeTarget('')
    } catch (e) {
      alert('รวมไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setBusy(false) }
  }

  const toggleActive = (l: Location) => updateLocation.mutate({ id: l.id, patch: { active: !l.active } })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการสถานที่</h1>
          <div className="page-sub">
            {rows.length} ชื่อ • ในทะเบียน {locations.length}{orphanCount > 0 && <> • ยังไม่ลงทะเบียน {orphanCount}</>} — แก้ชื่อที่นี่จะอัปเดตงานเก่าที่ใช้ชื่อนั้นทุกขา
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openCreate}>
            <Icon name="plus" size={15} /> เพิ่มสถานที่ใหม่
          </button>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="ค้นหาสถานที่ / จังหวัด..." width={280} />
        {busy && <span className="muted" style={{ marginLeft: 12, fontSize: 13 }}>⏳ กำลังอัปเดตงานที่เกี่ยวข้อง…</span>}
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>สถานที่</th>
              <th>หมวด</th>
              <th>จังหวัด</th>
              <th className="num right">ใช้ในงาน</th>
              <th>ทะเบียน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name} style={{ opacity: r.master && !r.master.active ? 0.55 : 1 }}>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  {r.master?.address && <div className="muted" style={{ fontSize: 11.5 }}>{r.master.address}</div>}
                </td>
                <td>{r.master?.category || <span className="muted">—</span>}</td>
                <td>{r.master?.province || <span className="muted">—</span>}</td>
                <td className="num right">{r.usage > 0 ? `${r.usage} ขา` : <span className="muted">—</span>}</td>
                <td>
                  {r.master
                    ? <StatusBadge status={r.master.active ? 'active' : 'inactive'} />
                    : <span className="badge amber" style={{ fontSize: 11 }}>ยังไม่ลงทะเบียน</span>}
                </td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn ghost icon sm" title="แก้ไขชื่อ / ลงทะเบียน" onClick={() => openEdit(r)} disabled={busy}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="btn ghost sm" title="รวมชื่อนี้เข้ากับอีกชื่อ" onClick={() => openMerge(r)} disabled={busy || rows.length < 2}>
                      <Icon name="swap" size={13} /> รวม
                    </button>
                    {r.master && (
                      <button
                        className="btn ghost sm"
                        title={r.master.active ? 'ปิดใช้งาน (ซ่อนจากตัวเลือก)' : 'เปิดใช้งาน'}
                        onClick={() => toggleActive(r.master!)}
                        disabled={busy}
                      >
                        {r.master.active ? 'ปิดใช้' : 'เปิดใช้'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="empty" style={{ padding: 32 }}>ยังไม่มีสถานที่ — กด “เพิ่มสถานที่ใหม่”</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* แก้ไข / เพิ่ม */}
      <Modal
        open={show}
        onClose={() => !busy && setShow(false)}
        title={editRow ? (editRow.master ? 'แก้ไขสถานที่' : 'แก้ชื่อ / ลงทะเบียนสถานที่') : 'เพิ่มสถานที่ใหม่'}
        footer={
          <>
            <button className="btn" onClick={() => setShow(false)} disabled={busy}>ยกเลิก</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </>
        }
      >
        {editRow && editRow.usage > 0 && (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12.5 }}>
            ℹ️ ชื่อนี้ถูกใช้ในงาน <strong>{editRow.usage} ขา</strong> — ถ้าแก้ชื่อ ระบบจะอัปเดตให้ทุกขาที่ใช้ชื่อเดิม (รวมงานที่ปิดแล้ว)
          </div>
        )}
        <div className="grid-2">
          <Field label="ชื่อสถานที่ *">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ท่าทราย เวียงสา" />
          </Field>
          <Field label="หมวด">
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="เช่น โรงงาน / ท่าเรือ / ท่าทราย" />
          </Field>
          <Field label="จังหวัด">
            <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} />
          </Field>
          <Field label="ที่อยู่">
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="หมายเหตุ">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', resize: 'vertical' }} />
          </Field>
        </div>
      </Modal>

      {/* รวมชื่อซ้ำ */}
      <Modal
        open={mergeRow != null}
        onClose={() => !busy && setMergeRow(null)}
        title="รวมชื่อสถานที่"
        footer={
          <>
            <button className="btn" onClick={() => setMergeRow(null)} disabled={busy}>ยกเลิก</button>
            <button className="btn primary" onClick={doMerge} disabled={busy || !mergeTarget}>
              {busy ? 'กำลังรวม…' : 'รวม'}
            </button>
          </>
        }
      >
        {mergeRow && (
          <>
            <p style={{ fontSize: 13.5, marginBottom: 14 }}>
              รวม “<strong>{mergeRow.name}</strong>” ({mergeRow.usage} ขา) เข้ากับชื่อที่ถูกต้อง — ทุกขาที่ใช้ชื่อนี้จะถูกเปลี่ยนเป็นชื่อปลายทาง และชื่อนี้จะถูกลบออกจากทะเบียน
            </p>
            <Field label="รวมเข้ากับชื่อ *">
              <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}>
                <option value="">— เลือกชื่อที่จะใช้ —</option>
                {rows.filter(r => r.name !== mergeRow.name).map(r => (
                  <option key={r.name} value={r.name}>{r.name}{r.usage > 0 ? ` (${r.usage} ขา)` : ''}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}
