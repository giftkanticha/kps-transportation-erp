import React, { useState } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert } from '../../hooks/useTable'
import { Icon, Field, StatusBadge, SearchInput } from '../../components/ui'
import type { Customer } from '../../types'

interface CustomerForm {
  name: string
  contact: string
  phone: string
  credit: number | string
  industry: string
  address: string
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

export function CustomersPage() {
  const [q, setQ] = useState('')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState<CustomerForm>({
    name: '',
    contact: '',
    phone: '',
    credit: 30,
    industry: '',
    address: '',
  })

  const { data: customers = [] } = useList<Customer>('customers')
  const insertCustomer = useInsert<Customer>('customers')
  const list = customers.filter(
    (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.code.includes(q),
  )

  const save = () => {
    if (!form.name) {
      alert('กรุณากรอกชื่อลูกค้า')
      return
    }
    if (insertCustomer.isPending) return
    insertCustomer.mutate(
      {
        name: form.name,
        contact: form.contact,
        phone: form.phone,
        industry: form.industry,
        address: form.address,
        code: 'CUS-' + (1000 + customers.length + 1),
        totalJobs: 0,
        openInvoice: 0,
        status: 'active',
        since: new Date().toISOString().slice(0, 10),
        credit: +form.credit,
      },
      {
        onSuccess: () => {
          setShow(false)
          setForm({ name: '', contact: '', phone: '', credit: 30, industry: '', address: '' })
        },
        onError: (err) => alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'),
      },
    )
  }

  const totalOpenInvoice = customers.reduce((s, c) => s + c.openInvoice, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ลูกค้า</h1>
          <div className="page-sub">
            {customers.length} ราย • ลูกหนี้คงค้างรวม {db.thb(totalOpenInvoice)}
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShow(true)}>
            <Icon name="plus" size={15} /> เพิ่มลูกค้าใหม่
          </button>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="ค้นหาลูกค้า..." width={280} />
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ลูกค้า</th>
              <th>ผู้ติดต่อ</th>
              <th>อุตสาหกรรม</th>
              <th>เครดิต</th>
              <th className="right">งานทั้งหมด</th>
              <th className="right">ลูกหนี้คงค้าง</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {c.address}
                  </div>
                </td>
                <td>
                  <div>{c.contact}</div>
                  <div className="muted mono" style={{ fontSize: 11.5 }}>
                    {c.phone}
                  </div>
                </td>
                <td>{c.industry}</td>
                <td className="num">{c.credit} วัน</td>
                <td className="num right">{c.totalJobs}</td>
                <td
                  className="num right"
                  style={{
                    color:
                      c.openInvoice > 500000
                        ? 'var(--red)'
                        : c.openInvoice > 0
                          ? 'var(--amber)'
                          : 'var(--text-muted)',
                    fontWeight: c.openInvoice > 0 ? 600 : 400,
                  }}
                >
                  {db.thb(c.openInvoice)}
                </td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="เพิ่มลูกค้าใหม่"
        footer={
          <>
            <button className="btn" onClick={() => setShow(false)} disabled={insertCustomer.isPending}>
              ยกเลิก
            </button>
            <button className="btn primary" onClick={save} disabled={insertCustomer.isPending}>
              {insertCustomer.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </>
        }
      >
        <div className="grid-2">
          <Field label="ชื่อลูกค้า / บริษัท *">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="ผู้ติดต่อ">
            <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
          </Field>
          <Field label="เบอร์โทร">
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="เครดิตเทอม (วัน)">
            <input
              type="number"
              value={form.credit}
              onChange={(e) => setForm((f) => ({ ...f, credit: e.target.value }))}
            />
          </Field>
          <Field label="อุตสาหกรรม">
            <input
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="เช่น Manufacturing"
            />
          </Field>
          <Field label="ที่อยู่ / เมือง">
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
