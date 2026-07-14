import React, { useState } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { Icon, Field, StatusBadge } from '../../components/ui'
import type { Partner } from '../../types'

interface PartnerForm {
  name: string
  type: string
  contact: string
  phone: string
  address: string
  bank: string
  account: string
  accountName: string
  taxId: string
}

function Modal({
  open,
  onClose,
  title,
  footer,
  children,
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <div style={{ flex: 1 }} />
          <button className="btn ghost icon sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  )
}

const EMPTY_FORM: PartnerForm = {
  name: '',
  type: '',
  contact: '',
  phone: '',
  address: '',
  bank: '',
  account: '',
  accountName: '',
  taxId: '',
}

export function PartnersPage() {
  const [show, setShow] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM)

  const { data: partners = [] } = useList<Partner>('partners')
  const insertPartner = useInsert<Partner>('partners')
  const updatePartner = useUpdate<Partner>('partners')
  const totalBalance = partners.reduce((s, p) => s + p.balance, 0)
  const busy = insertPartner.isPending || updatePartner.isPending

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShow(true) }
  const openEdit = (p: Partner) => {
    setEditId(p.id)
    setForm({
      name: p.name,
      type: p.type,
      contact: p.contact,
      phone: p.phone,
      address: p.address,
      bank: p.bank,
      account: p.account,
      accountName: p.accountName,
      taxId: p.taxId,
    })
    setShow(true)
  }

  const save = () => {
    if (!form.name) {
      alert('กรุณากรอกชื่อคู่ค้า')
      return
    }
    if (busy) return
    const onSuccess = () => { setShow(false); setForm(EMPTY_FORM); setEditId(null) }
    const onError = (err: unknown) => alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    if (editId) {
      updatePartner.mutate({ id: editId, patch: { ...form } }, { onSuccess, onError })
    } else {
      insertPartner.mutate(
        {
          ...form,
          code: 'PTN-' + (1000 + partners.length + 1),
          balance: 0,
          status: 'active',
        },
        { onSuccess, onError },
      )
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">คู่ค้า / ช่าง</h1>
          <div className="page-sub">
            {partners.length} ราย • ยอดค้างจ่ายรวม {db.thb(totalBalance)}
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openCreate}>
            <Icon name="plus" size={15} /> เพิ่มคู่ค้า
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ</th>
              <th>ประเภท</th>
              <th>ผู้ติดต่อ</th>
              <th>โทร</th>
              <th className="right">ยอดค้างจ่าย</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.code}</td>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td>
                  <span className="badge gray">{p.type}</span>
                </td>
                <td>{p.contact}</td>
                <td className="mono muted">{p.phone}</td>
                <td
                  className="num right"
                  style={{ fontWeight: 600, color: p.balance > 0 ? 'var(--red)' : 'var(--text-muted)' }}
                >
                  {db.thb(p.balance)}
                </td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn ghost icon sm" title="แก้ไข" onClick={() => openEdit(p)}>
                      <Icon name="edit" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editId ? 'แก้ไขข้อมูลคู่ค้า' : 'เพิ่มคู่ค้าใหม่'}
        footer={
          <>
            <button className="btn" onClick={() => setShow(false)} disabled={busy}>
              ยกเลิก
            </button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </>
        }
      >
        <div className="grid-2">
          <Field label="ชื่อคู่ค้า / ช่าง *">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="ประเภท">
            <input
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              placeholder="เช่น อู่ซ่อม, ปั๊มน้ำมัน"
            />
          </Field>
          <Field label="ผู้ติดต่อ">
            <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
          </Field>
          <Field label="เบอร์โทร">
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="ที่อยู่">
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>
          <Field label="ธนาคาร">
            <input value={form.bank} onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))} />
          </Field>
          <Field label="เลขบัญชี">
            <input value={form.account} onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))} />
          </Field>
          <Field label="ชื่อบัญชี">
            <input
              value={form.accountName}
              onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
            />
          </Field>
          <Field label="เลขผู้เสียภาษี">
            <input value={form.taxId} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
