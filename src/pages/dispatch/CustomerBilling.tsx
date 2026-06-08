import { useState, useMemo, useEffect } from 'react'
import { db } from '../../lib/db'
import { useDispatches } from '../../hooks/useDispatches'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { Icon, Field } from '../../components/ui'
import type { Customer, CompanyBankAccount, BillingNote, Dispatch, DispatchLeg } from '../../types'

const docTypeLabel = (t: BillingNote['docType']) => (t === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบวางบิล')

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

// ขาที่วางบิลได้ = ขา + รอบแม่ (ผูกวันที่/รหัสไว้ด้วย)
interface BillableLeg {
  leg: DispatchLeg
  round: Dispatch
  gross: number
  wht: number
  net: number
}

const roundMonth = (d: Dispatch) => (d.returnAt || d.depart || d.date || '').slice(0, 7)

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

  // default bank account = ที่ตั้งเป็นค่าเริ่มต้น ไม่งั้นตัวแรกที่ active
  useEffect(() => {
    if (bankAccountId) return
    const def = bankAccounts.find(b => b.isDefault && b.active) || bankAccounts.find(b => b.active)
    if (def) setBankAccountId(def.id)
  }, [bankAccounts, bankAccountId])

  // leg id ที่อยู่ในใบวางบิล (status≠void) แล้ว → เลือกซ้ำไม่ได้
  const billedLegIds = useMemo(() => {
    const s = new Set<string>()
    for (const n of notes) {
      if (n.status === 'void') continue
      for (const id of n.legIds ?? []) s.add(id)
    }
    return s
  }, [notes])

  // ขาทั้งหมด (พร้อมรอบแม่) ที่ปิดแล้ว มีลูกค้า + ยังไม่วางบิล
  const allBillableLegs = useMemo<BillableLeg[]>(() => {
    const out: BillableLeg[] = []
    for (const d of dispatches) {
      if (d.roundStatus !== 'closed') continue
      for (const leg of d.legs ?? []) {
        if (!leg.customerId || !leg.id) continue
        if ((leg.amount || 0) <= 0) continue
        const wht = db.legWht(leg)
        out.push({ leg, round: d, gross: leg.amount || 0, wht, net: (leg.amount || 0) - wht })
      }
    }
    return out
  }, [dispatches])

  const eligible = useMemo(
    () => allBillableLegs
      .filter(b => b.leg.customerId === customerId && roundMonth(b.round) === month && !billedLegIds.has(b.leg.id!))
      .sort((a, b) => (a.round.date || '').localeCompare(b.round.date || '')),
    [allBillableLegs, customerId, month, billedLegIds],
  )

  const selectedLegs = useMemo(() => eligible.filter(b => selected.has(b.leg.id!)), [eligible, selected])
  const gross = selectedLegs.reduce((s, b) => s + b.gross, 0)
  const whtAmount = selectedLegs.reduce((s, b) => s + b.wht, 0)
  const net = gross - whtAmount

  const customer = customers.find(c => c.id === customerId)

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(prev =>
    prev.size === eligible.length ? new Set() : new Set(eligible.map(b => b.leg.id!)),
  )

  const customerNotes = useMemo(
    () => notes
      .filter(n => n.customerId === customerId && `${n.year}-${String(n.month).padStart(2, '0')}` === month)
      .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || '')),
    [notes, customerId, month],
  )

  const issue = async (docType: BillingNote['docType']) => {
    if (!customerId || selectedLegs.length === 0) { alert('เลือกลูกค้าและขาอย่างน้อย 1 รายการ'); return }
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
        legIds: selectedLegs.map(b => b.leg.id!),
        status: docType === 'receipt' ? 'paid' : 'issued',
        notes: '',
      })
      setSelected(new Set())
      setPrintNote(created)
    } catch (e) {
      alert('ออกเอกสารไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const markNotePaid = async (n: BillingNote) => {
    if (!confirm(`บันทึกว่าได้รับเงินตาม ${docTypeLabel(n.docType)} ${n.code} แล้ว?`)) return
    await updateNote.mutateAsync({ id: n.id, patch: { status: 'paid', paidAt: new Date().toISOString() } })
  }

  const voidNote = async (n: BillingNote) => {
    if (!confirm(`ยกเลิก ${docTypeLabel(n.docType)} ${n.code}? ขาในบิลจะกลับมาเลือกวางบิลใหม่ได้`)) return
    await updateNote.mutateAsync({ id: n.id, patch: { status: 'void' } })
  }

  // พิมพ์: แสดง print-only document แล้วเรียก window.print()
  useEffect(() => {
    if (!printNote) return
    const t = setTimeout(() => { window.print(); setPrintNote(null) }, 60)
    return () => clearTimeout(t)
  }, [printNote])

  const noteBank = (n: BillingNote) => bankAccounts.find(b => b.id === n.bankAccountId)
  // หา BillableLeg จาก leg id (รวมที่วางบิลไปแล้ว) เพื่อพิมพ์รายการ
  const legsForNote = (n: BillingNote): BillableLeg[] => {
    const ids = new Set(n.legIds ?? [])
    const out: BillableLeg[] = []
    for (const d of dispatches) {
      for (const leg of d.legs ?? []) {
        if (leg.id && ids.has(leg.id)) {
          const wht = db.legWht(leg)
          out.push({ leg, round: d, gross: leg.amount || 0, wht, net: (leg.amount || 0) - wht })
        }
      }
    }
    return out
  }

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุป / วางบิลรายลูกค้า</h1>
          <div className="page-sub">เลือกขาที่ปิดงานแล้วของลูกค้ามาออกใบวางบิล (หัก ณ ที่จ่าย 1% + เลขบัญชีบริษัท)</div>
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
          <Field label="เดือน / ปี">
            <div className="row" style={{ gap: 8 }}>
              <select
                value={Number(month.slice(5, 7))}
                onChange={e => { setMonth(`${month.slice(0, 4)}-${String(Number(e.target.value)).padStart(2, '0')}`); setSelected(new Set()) }}
                style={{ flex: 1 }}
              >
                {THAI_MONTHS.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
              </select>
              <select
                value={Number(month.slice(0, 4))}
                onChange={e => { setMonth(`${e.target.value}-${month.slice(5, 7)}`); setSelected(new Set()) }}
                style={{ flex: 1 }}
              >
                {Array.from({ length: 5 }, (_, i) => 2026 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </Field>
        </div>
        {customers.length === 0 && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 10, color: 'var(--amber)' }}>
            ⚠️ ยังไม่มีลูกค้าในระบบ — เพิ่มลูกค้าที่เมนู “ลูกค้า” ก่อน แล้วผูกลูกค้าให้แต่ละขาตอนเปิดงาน
          </div>
        )}
      </div>

      {customerId && (
        <>
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="head">
              <h3>ขาที่ปิดงานแล้ว ยังไม่วางบิล ({eligible.length})</h3>
            </div>
            {eligible.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>
                ไม่มีขาของลูกค้ารายนี้ที่ปิดงานแล้วและยังไม่วางบิลในเดือนนี้
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  (ขาจะมาที่นี่เมื่อ: ผูกลูกค้ารายนี้ที่ขา + ปิดงานรอบนั้นแล้ว + มีค่าขนส่ง &gt; 0)
                </div>
              </div>
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
                      <th>สินค้า</th>
                      <th className="num right">ยอดเต็ม</th>
                      <th className="num right">หัก 1%</th>
                      <th className="num right">สุทธิ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map(b => (
                      <tr key={b.leg.id} onClick={() => toggle(b.leg.id!)} style={{ cursor: 'pointer', background: selected.has(b.leg.id!) ? 'var(--primary-50)' : undefined }}>
                        <td><input type="checkbox" checked={selected.has(b.leg.id!)} onChange={() => toggle(b.leg.id!)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--primary)' }} /></td>
                        <td className="mono">{b.round.code}</td>
                        <td>{db.thaiDate(b.round.date)}</td>
                        <td style={{ fontSize: 12.5 }}>{b.leg.origin} → {b.leg.destination}</td>
                        <td style={{ fontSize: 12.5 }}>{b.leg.cargoType || '—'}</td>
                        <td className="num right">{db.thb(b.gross)}</td>
                        <td className="num right" style={{ color: b.wht > 0 ? 'var(--amber)' : undefined }}>{b.wht > 0 ? `− ${db.thb(b.wht)}` : '—'}</td>
                        <td className="num right">{db.thb(b.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedLegs.length > 0 && (
            <div className="card pad no-print" style={{ marginBottom: 16 }}>
              <div className="grid-2" style={{ gap: 18, alignItems: 'end' }}>
                <div>
                  <div className="row" style={{ fontSize: 14 }}><span>ยอดรวม ({selectedLegs.length} ขา)</span><div className="spacer" /><span className="mono">{db.thb(gross)}</span></div>
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
              <tr><th>รหัสรอบ</th><th>วันที่</th><th>เส้นทาง</th><th>สินค้า</th><th className="num right">ยอดเต็ม</th><th className="num right">หัก 1%</th><th className="num right">สุทธิ</th></tr>
            </thead>
            <tbody>
              {legsForNote(printNote).map(b => (
                <tr key={b.leg.id}>
                  <td className="mono">{b.round.code}</td>
                  <td>{db.thaiDate(b.round.date)}</td>
                  <td>{b.leg.origin} → {b.leg.destination}</td>
                  <td>{b.leg.cargoType || '—'}</td>
                  <td className="num right">{db.thb(b.gross)}</td>
                  <td className="num right">{b.wht > 0 ? `− ${db.thb(b.wht)}` : '—'}</td>
                  <td className="num right">{db.thb(b.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} className="right"><strong>รวม</strong></td><td className="num right">{db.thb(printNote.gross)}</td><td className="num right">− {db.thb(printNote.whtAmount)}</td><td className="num right"><strong>{db.thb(printNote.net)}</strong></td></tr>
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
