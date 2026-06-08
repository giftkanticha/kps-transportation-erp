import { useState, useMemo, useEffect } from 'react'
import { db } from '../../lib/db'
import { useDispatches } from '../../hooks/useDispatches'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { Icon, Field } from '../../components/ui'
import type { Customer, CompanyBankAccount, BillingNote, Dispatch } from '../../types'

const monthKey = (d: Dispatch) => (d.returnAt || d.depart || d.date || '').slice(0, 7)
const docTypeLabel = (t: BillingNote['docType']) => (t === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบวางบิล')

export function CustomerBilling() {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const [customerId, setCustomerId] = useState('')
  const [month, setMonth] = useState(thisMonth)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bankAccountId, setBankAccountId] = useState('')
  const [printNote, setPrintNote] = useState<BillingNote | null>(null)

  const { data: customers = [] } = useList<Customer>('customers')
  const { data: dispatches = [] } = useDispatches()
  const { data: bankAccounts = [] } = useList<CompanyBankAccount>('company_bank_accounts')
  const { data: notes = [] } = useList<BillingNote>('billing_notes')
  const insertNote = useInsert<BillingNote>('billing_notes')
  const updateNote = useUpdate<BillingNote>('billing_notes')
  const updateDispatch = useUpdate<Dispatch>('dispatch')

  // default bank account = the flagged default, else first active
  useEffect(() => {
    if (bankAccountId) return
    const def = bankAccounts.find(b => b.isDefault && b.active) || bankAccounts.find(b => b.active)
    if (def) setBankAccountId(def.id)
  }, [bankAccounts, bankAccountId])

  // dispatch ids already on a non-void billing note → not selectable again
  const billedIds = useMemo(() => {
    const s = new Set<string>()
    for (const n of notes) {
      if (n.status === 'void') continue
      for (const id of n.dispatchIds ?? []) s.add(id)
    }
    return s
  }, [notes])

  const eligible = useMemo(
    () => dispatches
      .filter(d => d.customerId === customerId && d.roundStatus === 'closed' && monthKey(d) === month && !billedIds.has(d.id))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [dispatches, customerId, month, billedIds],
  )

  const selectedRounds = useMemo(() => eligible.filter(d => selected.has(d.id)), [eligible, selected])
  const gross = selectedRounds.reduce((s, d) => s + db.roundRevenue(d), 0)
  const whtAmount = selectedRounds.reduce((s, d) => s + db.roundWht(d), 0)
  const net = gross - whtAmount

  const customer = customers.find(c => c.id === customerId)

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(prev =>
    prev.size === eligible.length ? new Set() : new Set(eligible.map(d => d.id)),
  )

  const customerNotes = useMemo(
    () => notes
      .filter(n => n.customerId === customerId && `${n.year}-${String(n.month).padStart(2, '0')}` === month)
      .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || '')),
    [notes, customerId, month],
  )

  const issue = async (docType: BillingNote['docType']) => {
    if (!customerId || selectedRounds.length === 0) { alert('เลือกลูกค้าและงานอย่างน้อย 1 รอบ'); return }
    if (insertNote.isPending) return
    const [y, m] = month.split('-').map(Number)
    const seq = notes.filter(n => n.year === y && n.month === m).length + 1
    const prefix = docType === 'receipt' ? 'RC' : 'BN'
    const code = `${prefix}-${y}-${String(m).padStart(2, '0')}-${String(seq).padStart(4, '0')}`
    try {
      const created = await insertNote.mutateAsync({
        code,
        docType,
        customerId,
        customerName: customer?.name ?? '',
        year: y,
        month: m,
        bankAccountId: bankAccountId || null,
        gross,
        whtAmount,
        net,
        dispatchIds: selectedRounds.map(d => d.id),
        status: docType === 'receipt' ? 'paid' : 'issued',
        notes: '',
      })
      // ออกใบเสร็จ = ได้รับเงินแล้ว → mark งานที่ผูกเป็นชำระแล้ว
      if (docType === 'receipt') await markRoundsPaid(selectedRounds)
      setSelected(new Set())
      setPrintNote(created)
    } catch (e) {
      alert('ออกเอกสารไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const markRoundsPaid = async (rounds: Dispatch[]) => {
    for (const d of rounds) {
      await updateDispatch.mutateAsync({
        id: d.id,
        patch: { paymentStatus: 'paid', amountPaid: db.roundNetRevenue(d), paidAt: new Date().toISOString() },
      })
    }
  }

  // มาร์คใบวางบิลเป็นชำระแล้ว + อัปเดตงานที่ผูกในบิลให้เป็น paid
  const markNotePaid = async (n: BillingNote) => {
    if (!confirm(`บันทึกว่าได้รับเงินตาม ${docTypeLabel(n.docType)} ${n.code} แล้ว?`)) return
    await updateNote.mutateAsync({ id: n.id, patch: { status: 'paid', paidAt: new Date().toISOString() } })
    const rounds = dispatches.filter(d => (n.dispatchIds ?? []).includes(d.id))
    await markRoundsPaid(rounds)
  }

  const voidNote = async (n: BillingNote) => {
    if (!confirm(`ยกเลิก ${docTypeLabel(n.docType)} ${n.code}? งานในบิลจะกลับมาเลือกวางบิลใหม่ได้`)) return
    await updateNote.mutateAsync({ id: n.id, patch: { status: 'void' } })
  }

  // พิมพ์: แสดง print-only document แล้วเรียก window.print()
  useEffect(() => {
    if (!printNote) return
    const t = setTimeout(() => { window.print(); setPrintNote(null) }, 60)
    return () => clearTimeout(t)
  }, [printNote])

  const noteBank = (n: BillingNote) => bankAccounts.find(b => b.id === n.bankAccountId)
  const noteRounds = (n: BillingNote) => dispatches.filter(d => (n.dispatchIds ?? []).includes(d.id))

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุป / วางบิลรายลูกค้า</h1>
          <div className="page-sub">เลือกงานที่ปิดแล้วของลูกค้ามาออกใบวางบิล (หัก ณ ที่จ่าย 1% + เลขบัญชีบริษัท)</div>
        </div>
      </div>

      <div className="card pad no-print" style={{ marginBottom: 16 }}>
        <div className="grid-2" style={{ gap: 14 }}>
          <Field label="ลูกค้า *">
            <select value={customerId} onChange={e => { setCustomerId(e.target.value); setSelected(new Set()) }}>
              <option value="">— เลือกลูกค้า —</option>
              {customers.slice().sort((a, b) => a.name.localeCompare(b.name, 'th')).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="เดือน">
            <input type="month" value={month} onChange={e => { setMonth(e.target.value); setSelected(new Set()) }} />
          </Field>
        </div>
      </div>

      {customerId && (
        <>
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="head">
              <h3>งานที่ปิดแล้ว ยังไม่วางบิล ({eligible.length})</h3>
            </div>
            {eligible.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>ไม่มีงานปิดแล้วที่ยังไม่วางบิลในเดือนนี้</div>
            ) : (
              <div className="tbl-wrap" style={{ border: 'none' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" checked={selected.size === eligible.length && eligible.length > 0} onChange={toggleAll} style={{ accentColor: 'var(--primary)' }} />
                      </th>
                      <th>รหัสรอบ</th>
                      <th>วันที่</th>
                      <th>เส้นทาง</th>
                      <th className="num right">ยอดเต็ม</th>
                      <th className="num right">หัก 1%</th>
                      <th className="num right">สุทธิ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map(d => {
                      const g = db.roundRevenue(d), w = db.roundWht(d)
                      const route = (d.legs ?? []).map(l => `${l.origin}→${l.destination}`).join(', ')
                      return (
                        <tr key={d.id} onClick={() => toggle(d.id)} style={{ cursor: 'pointer', background: selected.has(d.id) ? 'var(--primary-50)' : undefined }}>
                          <td><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--primary)' }} /></td>
                          <td className="mono">{d.code}</td>
                          <td>{db.thaiDate(d.date)}</td>
                          <td style={{ fontSize: 12.5, maxWidth: 280 }}>{route || '—'}</td>
                          <td className="num right">{db.thb(g)}</td>
                          <td className="num right" style={{ color: w > 0 ? 'var(--amber)' : undefined }}>{w > 0 ? `− ${db.thb(w)}` : '—'}</td>
                          <td className="num right">{db.thb(g - w)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedRounds.length > 0 && (
            <div className="card pad no-print" style={{ marginBottom: 16 }}>
              <div className="grid-2" style={{ gap: 18, alignItems: 'end' }}>
                <div>
                  <div className="row" style={{ fontSize: 14 }}><span>ยอดรวม ({selectedRounds.length} รอบ)</span><div className="spacer" /><span className="mono">{db.thb(gross)}</span></div>
                  {whtAmount > 0 && <div className="row" style={{ fontSize: 14, color: 'var(--amber)' }}><span>หัก ณ ที่จ่าย 1%</span><div className="spacer" /><span className="mono">− {db.thb(whtAmount)}</span></div>}
                  <div className="row" style={{ fontSize: 16, fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}><span>ยอดสุทธิ</span><div className="spacer" /><span className="mono" style={{ color: 'var(--primary)' }}>{db.thb(net)}</span></div>
                </div>
                <div>
                  <Field label="บัญชีรับเงิน (พิมพ์บนใบวางบิล)">
                    <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
                      <option value="">— ไม่ระบุ —</option>
                      {bankAccounts.filter(b => b.active).map(b => (
                        <option key={b.id} value={b.id}>{b.bankName} {b.accountNo} ({b.accountName})</option>
                      ))}
                    </select>
                  </Field>
                  <div className="row btn-row" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                    <button className="btn" onClick={() => issue('receipt')} disabled={insertNote.isPending}>
                      <Icon name="check" size={14} /> ออกใบเสร็จ (รับเงินแล้ว)
                    </button>
                    <button className="btn primary" onClick={() => issue('billing_note')} disabled={insertNote.isPending}>
                      <Icon name="download" size={14} /> ออกใบวางบิล
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {customerNotes.length > 0 && (
            <div className="card no-print">
              <div className="head"><h3>เอกสารที่ออกแล้วในเดือนนี้ ({customerNotes.length})</h3></div>
              <div className="tbl-wrap" style={{ border: 'none' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>เลขที่</th><th>ประเภท</th><th className="num right">ยอดสุทธิ</th><th>สถานะ</th><th></th></tr>
                  </thead>
                  <tbody>
                    {customerNotes.map(n => (
                      <tr key={n.id} style={{ opacity: n.status === 'void' ? 0.5 : 1 }}>
                        <td className="mono">{n.code}</td>
                        <td>{docTypeLabel(n.docType)}</td>
                        <td className="num right">{db.thb(n.net)}</td>
                        <td>
                          <span className={`badge ${n.status === 'paid' ? 'green' : n.status === 'void' ? 'red' : 'amber'}`} style={{ fontSize: 11 }}>
                            {n.status === 'paid' ? 'รับเงินแล้ว' : n.status === 'void' ? 'ยกเลิก' : 'รอชำระ'}
                          </span>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn ghost sm" onClick={() => setPrintNote(n)}><Icon name="download" size={13} /> พิมพ์</button>
                            {n.status === 'issued' && <button className="btn ghost sm" onClick={() => markNotePaid(n)} style={{ color: 'var(--green)' }}>รับเงินแล้ว</button>}
                            {n.status !== 'void' && <button className="btn ghost sm" onClick={() => voidNote(n)} style={{ color: 'var(--red)' }}>ยกเลิก</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── เอกสารสำหรับพิมพ์ (แสดงเฉพาะตอนพิมพ์) ── */}
      {printNote && (
        <div className="print-only">
          <div className="kps-print-header">
            <p className="co">KPS TRANSPORTATION</p>
            <p className="ttl">{docTypeLabel(printNote.docType)}</p>
            <p className="sub">เลขที่ {printNote.code} · ประจำเดือน {printNote.month}/{printNote.year}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: 8 }}>
            <div><strong>ลูกค้า:</strong> {printNote.customerName}</div>
            <div><strong>วันที่ออก:</strong> {db.thaiDate((printNote.issuedAt || new Date().toISOString()).slice(0, 10))}</div>
          </div>
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr><th>รหัสรอบ</th><th>วันที่</th><th>เส้นทาง</th><th className="num right">ยอดเต็ม</th><th className="num right">หัก 1%</th><th className="num right">สุทธิ</th></tr>
            </thead>
            <tbody>
              {noteRounds(printNote).map(d => {
                const g = db.roundRevenue(d), w = db.roundWht(d)
                const route = (d.legs ?? []).map(l => `${l.origin}→${l.destination}`).join(', ')
                return (
                  <tr key={d.id}>
                    <td className="mono">{d.code}</td>
                    <td>{db.thaiDate(d.date)}</td>
                    <td>{route}</td>
                    <td className="num right">{db.thb(g)}</td>
                    <td className="num right">{w > 0 ? `− ${db.thb(w)}` : '—'}</td>
                    <td className="num right">{db.thb(g - w)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="right"><strong>รวม</strong></td><td className="num right">{db.thb(printNote.gross)}</td><td className="num right">− {db.thb(printNote.whtAmount)}</td><td className="num right"><strong>{db.thb(printNote.net)}</strong></td></tr>
            </tfoot>
          </table>
          {noteBank(printNote) && (
            <div style={{ marginTop: 12, fontSize: '9pt', border: '1px solid #ccc', padding: 8, borderRadius: 4 }}>
              <strong>ชำระเงินโดยโอนเข้าบัญชี:</strong> {noteBank(printNote)!.bankName} เลขที่ {noteBank(printNote)!.accountNo}
              {' '}ชื่อบัญชี {noteBank(printNote)!.accountName}{noteBank(printNote)!.branch ? ` สาขา ${noteBank(printNote)!.branch}` : ''}
            </div>
          )}
          <div className="kps-print-sig">
            <div className="kps-print-sig-slot"><div className="line">ผู้วางบิล</div></div>
            <div className="kps-print-sig-slot"><div className="line">ผู้รับวางบิล</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
