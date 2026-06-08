import React, { useState } from 'react'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { Icon, Field, StatusBadge } from '../../components/ui'
import type { CompanyBankAccount } from '../../types'

interface BankForm {
  bankName: string
  accountNo: string
  accountName: string
  branch: string
  isDefault: boolean
}

const EMPTY: BankForm = { bankName: '', accountNo: '', accountName: '', branch: '', isDefault: false }

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <div style={{ flex: 1 }} />
          <button className="btn ghost icon sm" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>
      </div>
    </div>
  )
}

export function CompanyBankAccountsPage() {
  const [show, setShow] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<BankForm>(EMPTY)

  const { data: accounts = [] } = useList<CompanyBankAccount>('company_bank_accounts')
  const insertAcc = useInsert<CompanyBankAccount>('company_bank_accounts')
  const updateAcc = useUpdate<CompanyBankAccount>('company_bank_accounts')
  const deleteAcc = useDelete('company_bank_accounts')

  const busy = insertAcc.isPending || updateAcc.isPending

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShow(true) }
  const openEdit = (a: CompanyBankAccount) => {
    setEditId(a.id)
    setForm({ bankName: a.bankName, accountNo: a.accountNo, accountName: a.accountName, branch: a.branch, isDefault: a.isDefault })
    setShow(true)
  }

  const save = () => {
    if (!form.bankName.trim() || !form.accountNo.trim() || !form.accountName.trim()) {
      alert('กรุณากรอกธนาคาร เลขบัญชี และชื่อบัญชี'); return
    }
    if (busy) return
    const onError = (err: unknown) => alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    const onSuccess = () => { setShow(false); setForm(EMPTY); setEditId(null) }
    if (editId) updateAcc.mutate({ id: editId, patch: { ...form } }, { onSuccess, onError })
    else insertAcc.mutate({ ...form, active: true }, { onSuccess, onError })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">บัญชีธนาคารบริษัท</h1>
          <div className="page-sub">{accounts.length} บัญชี — ใช้พิมพ์บนใบวางบิลให้ลูกค้าโอนเงิน</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openCreate}><Icon name="plus" size={15} /> เพิ่มบัญชี</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>ธนาคาร</th><th>เลขบัญชี</th><th>ชื่อบัญชี</th><th>สาขา</th><th>ค่าเริ่มต้น</th><th></th></tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <td>{a.bankName}</td>
                <td className="mono">{a.accountNo}</td>
                <td>{a.accountName}</td>
                <td>{a.branch || <span className="muted">—</span>}</td>
                <td>{a.isDefault ? <StatusBadge status="active" /> : <span className="muted">—</span>}</td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn ghost icon sm" title="แก้ไข" onClick={() => openEdit(a)}><Icon name="edit" size={14} /></button>
                    <button className="btn ghost icon sm" title="ลบ" style={{ color: 'var(--red)' }}
                      onClick={() => { if (confirm(`ลบบัญชี ${a.bankName} ${a.accountNo}?`)) deleteAcc.mutate(a.id) }}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={6} className="empty" style={{ padding: 32 }}>ยังไม่มีบัญชี — กด “เพิ่มบัญชี”</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editId ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีธนาคาร'}
        footer={
          <>
            <button className="btn" onClick={() => setShow(false)} disabled={busy}>ยกเลิก</button>
            <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </>
        }
      >
        <div className="grid-2">
          <Field label="ธนาคาร *"><input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="เช่น กสิกรไทย" /></Field>
          <Field label="เลขที่บัญชี *"><input value={form.accountNo} onChange={e => setForm(f => ({ ...f, accountNo: e.target.value }))} /></Field>
          <Field label="ชื่อบัญชี *"><input value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} /></Field>
          <Field label="สาขา"><input value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} /></Field>
        </div>
        <label className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13, marginTop: 12 }}>
          <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} style={{ accentColor: 'var(--primary)' }} />
          <span>ตั้งเป็นบัญชีเริ่มต้น (เลือกอัตโนมัติบนใบวางบิล)</span>
        </label>
      </Modal>
    </div>
  )
}
