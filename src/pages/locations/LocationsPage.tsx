import React, { useState } from 'react'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { Icon, Field, StatusBadge, SearchInput } from '../../components/ui'
import type { Location } from '../../types'

interface LocationForm {
  name: string
  category: string
  province: string
  address: string
  notes: string
}

const EMPTY: LocationForm = { name: '', category: '', province: '', address: '', notes: '' }

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
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<LocationForm>(EMPTY)

  const { data: locations = [] } = useList<Location>('locations')
  const insertLocation = useInsert<Location>('locations')
  const updateLocation = useUpdate<Location>('locations')

  const list = locations
    .filter(l => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.province.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'th'))

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShow(true) }
  const openEdit = (l: Location) => {
    setEditId(l.id)
    setForm({ name: l.name, category: l.category, province: l.province, address: l.address, notes: l.notes })
    setShow(true)
  }

  const busy = insertLocation.isPending || updateLocation.isPending

  const save = () => {
    if (!form.name.trim()) { alert('กรุณากรอกชื่อสถานที่'); return }
    if (busy) return
    const onError = (err: unknown) => alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    const onSuccess = () => { setShow(false); setForm(EMPTY); setEditId(null) }
    if (editId) {
      updateLocation.mutate({ id: editId, patch: { ...form, name: form.name.trim() } }, { onSuccess, onError })
    } else {
      insertLocation.mutate({ ...form, name: form.name.trim(), active: true }, { onSuccess, onError })
    }
  }

  const toggleActive = (l: Location) => {
    updateLocation.mutate({ id: l.id, patch: { active: !l.active } })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการสถานที่</h1>
          <div className="page-sub">
            {locations.length} แห่ง • ใช้งาน {locations.filter(l => l.active).length} แห่ง — ใช้เป็นตัวเลือกต้นทาง/ปลายทางในงานขนส่ง
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
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>สถานที่</th>
              <th>หมวด</th>
              <th>จังหวัด</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(l => (
              <tr key={l.id} style={{ opacity: l.active ? 1 : 0.55 }}>
                <td>
                  <div style={{ fontWeight: 500 }}>{l.name}</div>
                  {l.address && <div className="muted" style={{ fontSize: 11.5 }}>{l.address}</div>}
                </td>
                <td>{l.category || <span className="muted">—</span>}</td>
                <td>{l.province || <span className="muted">—</span>}</td>
                <td><StatusBadge status={l.active ? 'active' : 'inactive'} /></td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn ghost icon sm" title="แก้ไข" onClick={() => openEdit(l)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      className="btn ghost sm"
                      title={l.active ? 'ปิดใช้งาน (ซ่อนจากตัวเลือก)' : 'เปิดใช้งาน'}
                      onClick={() => toggleActive(l)}
                    >
                      {l.active ? 'ปิดใช้' : 'เปิดใช้'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="empty" style={{ padding: 32 }}>ยังไม่มีสถานที่ — กด “เพิ่มสถานที่ใหม่”</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editId ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่ใหม่'}
        footer={
          <>
            <button className="btn" onClick={() => setShow(false)} disabled={busy}>ยกเลิก</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </>
        }
      >
        <div className="grid-2">
          <Field label="ชื่อสถานที่ *">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น โรงงาน KPS ระยอง" />
          </Field>
          <Field label="หมวด">
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="เช่น โรงงาน / ท่าเรือ / ลูกค้า" />
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
    </div>
  )
}
