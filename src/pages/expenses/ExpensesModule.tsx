import React, { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import { Icon, Field, Info } from '../../components/ui'
import type { ExpenseHeader, ExpenseLine, Partner, Vehicle, StockItem, StockReceipt } from '../../types'

interface ExpensesModuleProps {
  tab: string
  setActive: (id: string) => void
}

const CATEGORIES = ['ค่าบริการ', 'อะไหล่', 'ยาง', 'น้ำมัน', 'อื่นๆ']
const KPS_WAREHOUSE_NAME = 'คลังอะไหล่ KPS'

const inlineInput: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 8px',
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#fff',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

// ── Helpers ───────────────────────────────────────────────────────
const isKPSPartner = (partnerId: string): boolean => {
  const p = db.get<Partner>('partners', partnerId)
  return !!p && p.name.replace(/\s+/g, '') === KPS_WAREHOUSE_NAME.replace(/\s+/g, '')
}

// Apply stock movement for KPS warehouse expense lines.
// sign = -1 to deduct (when adding/editing an expense), +1 to revert (when removing/editing)
const applyStockDelta = (lines: { stockItemId?: string; qty: number }[], sign: 1 | -1) => {
  lines.forEach((l) => {
    if (!l.stockItemId) return
    const s = db.get<StockItem>('stock', l.stockItemId)
    if (!s) return
    const q = +l.qty || 0
    db.update<StockItem>('stock', s.id, {
      qty: s.qty + sign * q,
      out: s.out - sign * q,
    })
  })
}

export function ExpensesModule({ tab, setActive }: ExpensesModuleProps) {
  const current =
    tab === 'finance'
      ? 'finance'
      : tab === 'stock'
        ? 'stock'
        : tab === 'report'
          ? 'report'
          : tab === 'vendors'
            ? 'vendors'
            : 'record'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ระบบค่าใช้จ่าย</h1>
        </div>
      </div>
      <div className="tabs" style={{ marginBottom: 22 }}>
        {(
          [
            ['record', '', 'บันทึกค่าใช้จ่าย'],
            ['finance', 'finance', 'สถานะการเงิน'],
            ['stock', 'stock', 'สต็อคคลัง KPS'],
            ['report', 'report', 'รายงานสรุป'],
            ['vendors', 'vendors', 'ทะเบียนร้านค้า/ช่าง'],
          ] as [string, string, string][]
        ).map(([id, route, label]) => (
          <button
            key={id}
            className={`tab ${current === id ? 'active' : ''}`}
            onClick={() => setActive('expenses' + (route ? '.' + route : ''))}
          >
            {label}
          </button>
        ))}
      </div>

      {current === 'record' && <ExpRecord />}
      {current === 'finance' && <ExpFinance />}
      {current === 'stock' && <ExpStock />}
      {current === 'report' && <ExpReport />}
      {current === 'vendors' && <ExpVendors />}
    </div>
  )
}

// ─── Tab 1: บันทึกค่าใช้จ่าย ─────────────────────────────────────────────────

interface LineItem {
  id?: string
  invoiceNo: string
  item: string
  category: string
  qty: number
  unitPrice: number
  note: string
  stockItemId?: string
}

interface HeaderForm {
  vehicleId: string
  partnerId: string
  date: string
  odometer: string
  paid: 'paid' | 'unpaid'
  dueDate: string
}

const emptyHeader = (): HeaderForm => ({
  vehicleId: '',
  partnerId: '',
  date: new Date().toISOString().slice(0, 10),
  odometer: '',
  paid: 'unpaid',
  dueDate: '',
})

const emptyLine = (): LineItem => ({
  invoiceNo: 'INV-',
  item: '',
  category: 'ค่าบริการ',
  qty: 1,
  unitPrice: 0,
  note: '',
})

// Form body shared between create and edit
function ExpenseFormBody({
  hdr,
  setHdr,
  lines,
  setLines,
  vehicles,
  partners,
  stocks,
}: {
  hdr: HeaderForm
  setHdr: (next: HeaderForm) => void
  lines: LineItem[]
  setLines: (next: LineItem[]) => void
  vehicles: Vehicle[]
  partners: Partner[]
  stocks: StockItem[]
}) {
  const setH = <K extends keyof HeaderForm>(k: K, v: HeaderForm[K]) =>
    setHdr({ ...hdr, [k]: v })

  const setLine = (i: number, k: keyof LineItem, v: string | number) =>
    setLines(
      lines.map((l, idx) =>
        idx === i
          ? { ...l, [k]: k === 'qty' || k === 'unitPrice' ? +v || 0 : v }
          : l,
      ),
    )

  const addLine = () => setLines([...lines, emptyLine()])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))

  const isKPS = isKPSPartner(hdr.partnerId)
  const totals = lines.map((l) => (l.qty || 0) * (l.unitPrice || 0))
  const netTotal = totals.reduce((s, t) => s + t, 0)

  // Auto-fill from selected stock item
  const pickStock = (i: number, stockId: string) => {
    const s = stocks.find((x) => x.id === stockId)
    setLines(
      lines.map((l, idx) =>
        idx === i
          ? {
              ...l,
              stockItemId: stockId,
              item: s?.name ?? '',
              unitPrice: s?.unitCost ?? 0,
              category: s?.category ?? l.category,
            }
          : l,
      ),
    )
  }

  return (
    <div>
      {/* General info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="head">
          <h3>ข้อมูลทั่วไป</h3>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลือกรถ *">
              <select value={hdr.vehicleId} onChange={(e) => setH('vehicleId', e.target.value)}>
                <option value="">-- เลือกรถ --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} • {v.brand}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="สถานะการชำระเงิน">
              <div className="row" style={{ gap: 18, paddingTop: 4 }}>
                <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                  <input
                    type="radio"
                    name="ex-paid"
                    checked={hdr.paid === 'unpaid'}
                    onChange={() => setH('paid', 'unpaid')}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>ยังไม่ชำระ</span>
                </label>
                <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                  <input
                    type="radio"
                    name="ex-paid"
                    checked={hdr.paid === 'paid'}
                    onChange={() => setH('paid', 'paid')}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>ชำระแล้ว</span>
                </label>
              </div>
            </Field>
            <Field label="ช่าง / ร้านค้า *">
              <select value={hdr.partnerId} onChange={(e) => setH('partnerId', e.target.value)}>
                <option value="">-- เลือกช่าง/ร้านค้า --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {isKPS && (
                <div className="faint" style={{ fontSize: 11.5, marginTop: 4, color: 'var(--primary)' }}>
                  ★ เมื่อจ่ายจากคลัง KPS รายการจะดึงจากสต๊อก และตัดจำนวนคงเหลืออัตโนมัติ
                </div>
              )}
            </Field>
            <Field label="วันครบกำหนดชำระ">
              <input type="date" value={hdr.dueDate} onChange={(e) => setH('dueDate', e.target.value)} />
            </Field>
            <Field label="วันที่ *">
              <input type="date" value={hdr.date} onChange={(e) => setH('date', e.target.value)} />
            </Field>
            <Field label="เลขไมล์ (km)">
              <input
                type="number"
                value={hdr.odometer}
                onChange={(e) => setH('odometer', e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

          <div
            style={{
              padding: '14px 18px',
              background: 'var(--primary-50)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 500 }}>ยอดรวมสุทธิ:</span>
            <div className="spacer" />
            <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
              {netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
            </span>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="head">
          <h3>รายการค่าใช้จ่าย</h3>
          <div className="right">
            <button className="btn outline sm" onClick={addLine}>
              <Icon name="plus" size={13} /> เพิ่มรายการ
            </button>
          </div>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>เลขเอกสาร</th>
                <th>รายการ</th>
                <th>ประเภท</th>
                <th className="right">จำนวน</th>
                <th className="right">ราคา/หน่วย</th>
                <th className="right">จำนวนเงิน</th>
                <th>หมายเหตุ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const stk = l.stockItemId ? stocks.find((s) => s.id === l.stockItemId) : undefined
                return (
                  <tr key={i}>
                    <td className="num muted">{i + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        value={l.invoiceNo}
                        onChange={(e) => setLine(i, 'invoiceNo', e.target.value)}
                        style={{ ...inlineInput, maxWidth: 90 }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', minWidth: 200 }}>
                      {isKPS ? (
                        <div>
                          <select
                            value={l.stockItemId ?? ''}
                            onChange={(e) => pickStock(i, e.target.value)}
                            style={inlineInput}
                          >
                            <option value="">-- เลือกสินค้าจากคลัง --</option>
                            {stocks.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} (คงเหลือ {s.qty} {s.unit})
                              </option>
                            ))}
                          </select>
                          {stk && (
                            <div className="faint" style={{ fontSize: 10.5, marginTop: 2 }}>
                              ราคาดึงจากสต๊อก {db.fmt(stk.unitCost)} ฿/{stk.unit}
                              {l.qty > stk.qty && (
                                <span style={{ color: 'var(--red)', marginLeft: 6 }}>
                                  ⚠ ไม่พอ (มี {stk.qty})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          value={l.item}
                          onChange={(e) => setLine(i, 'item', e.target.value)}
                          placeholder="ชื่อรายการ"
                          style={inlineInput}
                        />
                      )}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <select
                        value={l.category}
                        onChange={(e) => setLine(i, 'category', e.target.value)}
                        style={{ ...inlineInput, maxWidth: 110 }}
                        disabled={isKPS && !!l.stockItemId}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        value={l.qty}
                        onChange={(e) => setLine(i, 'qty', e.target.value)}
                        style={{ ...inlineInput, maxWidth: 70, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        value={l.unitPrice}
                        onChange={(e) => setLine(i, 'unitPrice', e.target.value)}
                        style={{ ...inlineInput, textAlign: 'right' }}
                        readOnly={isKPS && !!l.stockItemId}
                      />
                    </td>
                    <td className="num right mono" style={{ padding: '8px 10px', fontWeight: 600 }}>
                      {totals[i].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        value={l.note}
                        onChange={(e) => setLine(i, 'note', e.target.value)}
                        placeholder="หมายเหตุ"
                        style={inlineInput}
                      />
                    </td>
                    <td>
                      <button className="btn ghost icon sm danger" onClick={() => removeLine(i)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--green-50)' }}>
                <td colSpan={6} className="right" style={{ padding: '12px 16px', fontWeight: 700 }}>
                  Net Total
                </td>
                <td className="num right mono" style={{ padding: '12px 16px', fontWeight: 700, fontSize: 15, color: '#166534' }}>
                  {netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ExpRecord() {
  const vehicles = db.getAll<Vehicle>('vehicles')
  const partners = db.getAll<Partner>('partners')
  const stocks = db.getAll<StockItem>('stock')

  const [tick, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)
  const recent = useMemo(() => {
    void tick
    return db.getAll<ExpenseHeader>('expenseHeaders').slice(0, 8)
  }, [tick])

  const [hdr, setHdr] = useState<HeaderForm>(emptyHeader())
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [editing, setEditing] = useState<ExpenseHeader | null>(null)

  const handleSave = () => {
    if (!hdr.vehicleId || !hdr.partnerId) {
      alert('กรุณาเลือกรถและช่าง/ร้านค้า')
      return
    }
    if (lines.length === 0 || lines.every((l) => !l.item && !l.stockItemId)) {
      alert('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ')
      return
    }
    const netTotal = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0)
    const h = db.add<ExpenseHeader>('expenseHeaders', {
      id: uid('eh'),
      code: 'EXH-' + Date.now().toString().slice(-3),
      date: hdr.date,
      vehicleId: hdr.vehicleId,
      partnerId: hdr.partnerId,
      odometer: Number(hdr.odometer) || 0,
      paid: hdr.paid === 'paid',
      dueDate: hdr.dueDate,
      total: netTotal,
      lineCount: lines.length,
      note: lines.map((l) => l.item).filter(Boolean).join(', '),
    })
    lines.forEach((l) =>
      db.add<ExpenseLine>('expenseLines', {
        ...l,
        id: uid('el'),
        headerId: h.id,
        amount: (l.qty || 0) * (l.unitPrice || 0),
      }),
    )
    // Apply stock deduction for KPS warehouse
    if (isKPSPartner(hdr.partnerId)) {
      applyStockDelta(lines, -1)
    }
    alert('บันทึกเรียบร้อย')
    setHdr(emptyHeader())
    setLines([emptyLine()])
    refresh()
  }

  const handleReset = () => {
    setHdr(emptyHeader())
    setLines([emptyLine()])
  }

  return (
    <div>
      <ExpenseFormBody
        hdr={hdr}
        setHdr={setHdr}
        lines={lines}
        setLines={setLines}
        vehicles={vehicles}
        partners={partners}
        stocks={stocks}
      />

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginBottom: 18 }}>
        <button className="btn" onClick={handleReset}>
          <Icon name="close" size={14} /> รีเซ็ต
        </button>
        <button className="btn primary" onClick={handleSave}>
          บันทึก
        </button>
      </div>

      {/* Recent history with edit button */}
      <div className="card">
        <div className="head">
          <h3>ประวัติค่าใช้จ่ายล่าสุด</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ทะเบียนรถ</th>
                <th>ช่าง / ร้านค้า</th>
                <th className="right">จำนวนเงิน</th>
                <th>สถานะ</th>
                <th>รายการ</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((h) => (
                <tr key={h.id}>
                  <td className="num muted">{db.thaiDate(h.date)}</td>
                  <td>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">
                      {db.nameOf('vehicles', h.vehicleId)}
                    </span>
                  </td>
                  <td>{db.nameOf('partners', h.partnerId)}</td>
                  <td className="num right" style={{ fontWeight: 600 }}>
                    {db.fmt(h.total)} บาท
                  </td>
                  <td>
                    {h.paid ? (
                      <span className="badge green">ชำระแล้ว</span>
                    ) : (
                      <span className="badge amber">ค้างชำระ</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12.5, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.note}
                  </td>
                  <td>
                    <button className="btn ghost icon sm" onClick={() => setEditing(h)} title="แก้ไข">
                      <Icon name="edit" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">ยังไม่มีประวัติค่าใช้จ่าย</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ExpenseEditModal
          header={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
          vehicles={vehicles}
          partners={partners}
          stocks={stocks}
        />
      )}
    </div>
  )
}

// ─── Edit Expense Modal ──────────────────────────────────────────

function ExpenseEditModal({
  header,
  onClose,
  onSaved,
  vehicles,
  partners,
  stocks,
}: {
  header: ExpenseHeader
  onClose: () => void
  onSaved: () => void
  vehicles: Vehicle[]
  partners: Partner[]
  stocks: StockItem[]
}) {
  const oldLines = useMemo(
    () => db.getAll<ExpenseLine>('expenseLines').filter((l) => l.headerId === header.id),
    [header.id],
  )
  const wasKPS = isKPSPartner(header.partnerId)

  const [hdr, setHdr] = useState<HeaderForm>({
    vehicleId: header.vehicleId,
    partnerId: header.partnerId,
    date: header.date,
    odometer: String(header.odometer || ''),
    paid: header.paid ? 'paid' : 'unpaid',
    dueDate: header.dueDate,
  })
  const [lines, setLines] = useState<LineItem[]>(
    oldLines.map((l) => ({
      id: l.id,
      invoiceNo: l.invoiceNo,
      item: l.item,
      category: l.category,
      qty: l.qty,
      unitPrice: l.unitPrice,
      note: l.note,
      stockItemId: l.stockItemId,
    })),
  )

  const handleSave = () => {
    if (!hdr.vehicleId || !hdr.partnerId) {
      alert('กรุณาเลือกรถและช่าง/ร้านค้า')
      return
    }
    const netTotal = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0)

    // Revert old stock impact
    if (wasKPS) applyStockDelta(oldLines, +1)

    // Remove old lines
    oldLines.forEach((l) => db.remove('expenseLines', l.id))

    // Update header
    db.update<ExpenseHeader>('expenseHeaders', header.id, {
      ...hdr,
      paid: hdr.paid === 'paid',
      odometer: Number(hdr.odometer) || 0,
      total: netTotal,
      lineCount: lines.length,
      note: lines.map((l) => l.item).filter(Boolean).join(', '),
    })

    // Add new lines
    lines.forEach((l) =>
      db.add<ExpenseLine>('expenseLines', {
        ...l,
        id: uid('el'),
        headerId: header.id,
        amount: (l.qty || 0) * (l.unitPrice || 0),
      }),
    )

    // Apply new stock impact
    if (isKPSPartner(hdr.partnerId)) applyStockDelta(lines, -1)

    alert('บันทึกการแก้ไขเรียบร้อย')
    onSaved()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        className="card"
        style={{ width: 960, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            แก้ไขค่าใช้จ่าย {header.code}
          </h3>
          <button className="btn ghost icon sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 18 }}>
          <ExpenseFormBody
            hdr={hdr}
            setHdr={setHdr}
            lines={lines}
            setLines={setLines}
            vehicles={vehicles}
            partners={partners}
            stocks={stocks}
          />
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn primary" onClick={handleSave}>
            <Icon name="check" size={14} /> บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Confirmation ────────────────────────────────────────

function PayConfirmModal({
  header,
  partner,
  onClose,
  onPaid,
}: {
  header: ExpenseHeader
  partner: Partner | undefined
  onClose: () => void
  onPaid: () => void
}) {
  const confirm = () => {
    db.update<ExpenseHeader>('expenseHeaders', header.id, { paid: true })
    onPaid()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div className="card" style={{ width: 480, maxWidth: '95vw' }}>
        <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>ยืนยันการชำระเงิน</h3>
          <button className="btn ghost icon sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 22 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text-2)' }}>
            ตรวจสอบยอดก่อนยืนยัน เมื่อบันทึกแล้วสถานะจะเปลี่ยนเป็น{' '}
            <strong style={{ color: 'var(--green)' }}>ชำระแล้ว</strong>
          </p>
          <div style={{ padding: 16, background: 'var(--bg-sunk)', borderRadius: 10 }}>
            <div className="grid-2" style={{ gap: 10 }}>
              <Info label="รหัส AP" value={<span className="mono">{header.code}</span>} />
              <Info label="วันที่" value={db.thaiDate(header.date)} />
              <Info label="ช่าง / ร้านค้า" value={partner?.name ?? '—'} />
              <Info label="ธนาคาร" value={partner?.bank ?? '—'} />
              <Info
                label="เลขที่บัญชี"
                value={<span className="mono" style={{ fontWeight: 700 }}>{partner?.account ?? '—'}</span>}
              />
              <Info label="ชื่อบัญชี" value={partner?.accountName ?? '—'} />
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>ยอดที่จะชำระ</div>
              <span className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>
                {db.thb(header.total)}
              </span>
            </div>
          </div>
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn primary" onClick={confirm}>
            <Icon name="check" size={14} /> ยืนยันชำระเงิน
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: สถานะการเงิน ──────────────────────────────────────────────────────

function ExpFinance() {
  const [tick, setTick] = useState(0)
  const headers = useMemo(() => { void tick; return db.getAll<ExpenseHeader>('expenseHeaders') }, [tick])
  const partners = db.getAll<Partner>('partners')

  const today = new Date('2026-05-17')
  const unpaidHeaders = headers.filter((h) => !h.paid)
  const overdue = unpaidHeaders.filter((h) => h.dueDate && new Date(h.dueDate) < today)
  const totalUnpaid = unpaidHeaders.reduce((s, h) => s + h.total, 0)
  const totalPaid = headers.filter((h) => h.paid).reduce((s, h) => s + h.total, 0)
  const [filter, setFilter] = useState('all')
  const [payTarget, setPayTarget] = useState<ExpenseHeader | null>(null)

  const list =
    filter === 'overdue'
      ? overdue
      : filter === 'due'
        ? unpaidHeaders.filter((h) => !overdue.includes(h))
        : unpaidHeaders

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">ยอดค้างชำระทั้งหมด</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--red)' }}>
            {db.fmt(totalUnpaid)} ฿
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ชำระแล้ว</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--green)' }}>
            {db.fmt(totalPaid)} ฿
          </div>
        </div>
        <div className="card kpi">
          <div className="label">เกินกำหนดชำระ</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--red)' }}>
            {overdue.length} <span style={{ fontSize: 14, fontWeight: 500 }}>รายการ</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">รายการทั้งหมด</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
            {unpaidHeaders.length} <span style={{ fontSize: 14, fontWeight: 500 }}>รายการ</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="head">
          <h3>รายการเจ้าหนี้ (Accounts Payable)</h3>
          <div className="right">
            <Icon name="filter" size={14} style={{ color: 'var(--text-faint)' }} />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                height: 32,
                padding: '0 10px',
                border: '1px solid var(--line)',
                borderRadius: 6,
                background: '#fff',
                fontSize: 12.5,
              }}
            >
              <option value="all">ทั้งหมด</option>
              <option value="overdue">เกินกำหนด</option>
              <option value="due">ใกล้ครบกำหนด</option>
            </select>
          </div>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส AP</th>
                <th>ช่าง / ร้านค้า</th>
                <th>เลขที่บัญชี</th>
                <th>วันที่สร้าง</th>
                <th>ครบกำหนด</th>
                <th className="right">จำนวนเงิน</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((h, i) => {
                const isOverdue = h.dueDate && new Date(h.dueDate) < today
                const p = partners.find((x) => x.id === h.partnerId)
                return (
                  <tr key={h.id}>
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      AP-{String(i + 1).padStart(3, '0')}
                    </td>
                    <td>{p?.name ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>
                      {p?.account && p.account !== '—' ? (
                        <>
                          <div>{p.account}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{p.bank}</div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num muted">{db.thaiDate(h.date)}</td>
                    <td className="num muted">
                      {db.thaiDate(h.dueDate)}
                      {isOverdue && (
                        <span className="badge red" style={{ marginLeft: 6 }}>
                          เกินกำหนด
                        </span>
                      )}
                    </td>
                    <td className="num right" style={{ fontWeight: 700 }}>
                      {db.fmt(h.total)} ฿
                    </td>
                    <td>
                      <span className="badge amber">
                        <Icon name="alert" size={11} /> ค้างชำระ
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn sm"
                        style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }}
                        onClick={() => setPayTarget(h)}
                      >
                        <Icon name="money" size={12} /> บันทึกชำระ
                      </button>
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">ไม่มีรายการ</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payTarget && (
        <PayConfirmModal
          header={payTarget}
          partner={partners.find((p) => p.id === payTarget.partnerId)}
          onClose={() => setPayTarget(null)}
          onPaid={() => setTick((n) => n + 1)}
        />
      )}
    </div>
  )
}

// ─── Tab 3: สต๊อคคลัง KPS ────────────────────────────────────────────────────

function ExpStock() {
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)
  const stock = useMemo(() => { void tick; return db.getAll<StockItem>('stock') }, [tick])
  const receipts = useMemo(() => { void tick; return db.getAll<StockReceipt>('stockReceipts') }, [tick])
  const partners = db.getAll<Partner>('partners').filter((p) => p.name !== KPS_WAREHOUSE_NAME)

  const total = stock.reduce((s, r) => s + r.qty * r.unitCost, 0)
  const low = stock.filter((s) => s.qty <= s.reorderAt)

  // Receive form state
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today,
    partnerId: '',
    stockItemId: '',
    qty: '',
    unitPrice: '',
  })
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const formTotal = (parseFloat(form.qty) || 0) * (parseFloat(form.unitPrice) || 0)

  const onPickItem = (id: string) => {
    const s = stock.find((x) => x.id === id)
    setForm((f) => ({ ...f, stockItemId: id, unitPrice: f.unitPrice || (s ? String(s.unitCost) : '') }))
  }

  const submitReceipt = () => {
    if (!form.partnerId) { alert('กรุณาเลือกคู่ค้า'); return }
    if (!form.stockItemId) { alert('กรุณาเลือกรายการสินค้า'); return }
    const q = parseFloat(form.qty) || 0
    const p = parseFloat(form.unitPrice) || 0
    if (q <= 0) { alert('กรุณากรอกจำนวน'); return }
    if (p <= 0) { alert('กรุณากรอกราคาต่อหน่วย'); return }

    const s = stock.find((x) => x.id === form.stockItemId)
    if (!s) return

    // Weighted average cost
    const oldValue = s.qty * s.unitCost
    const newValue = q * p
    const newQty = s.qty + q
    const newAvgCost = newQty > 0 ? (oldValue + newValue) / newQty : p

    db.update<StockItem>('stock', s.id, {
      qty: newQty,
      in: s.in + q,
      unitCost: Math.round(newAvgCost * 100) / 100,
    })

    db.add<StockReceipt>('stockReceipts', {
      id: uid('sr'),
      date: form.date,
      partnerId: form.partnerId,
      stockItemId: s.id,
      qty: q,
      unitPrice: p,
      total: q * p,
    })

    alert('รับสินค้าเข้าคลังเรียบร้อย')
    setForm({ date: today, partnerId: '', stockItemId: '', qty: '', unitPrice: '' })
    refresh()
  }

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">รายการสินค้า</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stock.length} <span style={{ fontSize: 14, fontWeight: 500 }}>รายการ</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">มูลค่าสต๊อคทั้งหมด</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--primary)' }}>
            {db.fmt(total)} ฿
          </div>
        </div>
        <div className="card kpi">
          <div className="label">สินค้าหมด / ต่ำ</div>
          <div
            className="mono"
            style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: low.length > 0 ? 'var(--red)' : 'var(--green)' }}
          >
            {low.length} <span style={{ fontSize: 14, fontWeight: 500 }}>รายการ</span>
          </div>
        </div>
      </div>

      {/* Receive form */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head">
          <h3>รับสินค้าเข้าคลัง</h3>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="วันที่ *">
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="จากคู่ค้า *">
              <select value={form.partnerId} onChange={(e) => set('partnerId', e.target.value)}>
                <option value="">-- เลือกคู่ค้า --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="รายการสินค้า *">
              <select value={form.stockItemId} onChange={(e) => onPickItem(e.target.value)}>
                <option value="">-- เลือกสินค้า --</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (คงเหลือ {s.qty} {s.unit})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="จำนวน *">
              <input
                type="number"
                value={form.qty}
                onChange={(e) => set('qty', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="ราคาต่อหน่วย (฿) *">
              <input
                type="number"
                value={form.unitPrice}
                onChange={(e) => set('unitPrice', e.target.value)}
                placeholder="0"
              />
            </Field>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>รวมเงิน</div>
              <div
                style={{
                  height: 38,
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--primary-50)',
                  borderRadius: 8,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  fontSize: 16,
                }}
                className="mono"
              >
                {db.thb(formTotal)}
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button
              className="btn"
              onClick={() => setForm({ date: today, partnerId: '', stockItemId: '', qty: '', unitPrice: '' })}
            >
              <Icon name="close" size={14} /> ล้างฟอร์ม
            </button>
            <button className="btn primary" onClick={submitReceipt}>
              <Icon name="plus" size={14} /> เพิ่มสินค้า
            </button>
          </div>
        </div>
      </div>

      {/* Current stock summary */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head">
          <h3>จำนวนสต็อคสินค้าปัจจุบัน</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ลำดับ</th>
                <th>รายการสินค้า</th>
                <th className="right">จำนวนคงเหลือ</th>
                <th className="right">ราคาเฉลี่ย / หน่วย</th>
                <th className="right">มูลค่ารวม</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s, i) => (
                <tr key={s.id} style={s.qty <= s.reorderAt ? { background: 'var(--red-50)' } : undefined}>
                  <td className="num muted">{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{s.code}</div>
                  </td>
                  <td
                    className="num right"
                    style={{ fontWeight: 600, color: s.qty <= s.reorderAt ? 'var(--red)' : undefined }}
                  >
                    {s.qty} <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>{s.unit}</span>
                  </td>
                  <td className="num right">{db.fmt(s.unitCost)} ฿</td>
                  <td className="num right" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {db.fmt(s.qty * s.unitCost)} ฿
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--green-50)', fontWeight: 700 }}>
                <td colSpan={4} className="right">
                  มูลค่าสต็อครวม
                </td>
                <td className="num right" style={{ fontSize: 15, color: 'var(--primary)' }}>
                  {db.fmt(total)} ฿
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent receipts history */}
      {receipts.length > 0 && (
        <div className="card">
          <div className="head">
            <h3>ประวัติการรับเข้าล่าสุด</h3>
          </div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>คู่ค้า</th>
                  <th>รายการสินค้า</th>
                  <th className="right">จำนวน</th>
                  <th className="right">ราคา/หน่วย</th>
                  <th className="right">รวมเงิน</th>
                </tr>
              </thead>
              <tbody>
                {receipts.slice(0, 10).map((r) => {
                  const it = stock.find((s) => s.id === r.stockItemId)
                  return (
                    <tr key={r.id}>
                      <td className="num muted">{db.thaiDate(r.date)}</td>
                      <td>{db.nameOf('partners', r.partnerId)}</td>
                      <td>{it?.name ?? '—'}</td>
                      <td className="num right">{r.qty}</td>
                      <td className="num right">{db.fmt(r.unitPrice)} ฿</td>
                      <td className="num right" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {db.fmt(r.total)} ฿
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 4: รายงานสรุป (Unchanged) ───────────────────────────────────────────

function ExpReport() {
  const vehicles = db.getAll<Vehicle>('vehicles')
  const [innerTab, setInnerTab] = useState('repair')
  const headers = db.getAll<ExpenseHeader>('expenseHeaders')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')

  const filteredHeaders = headers.filter((h) => {
    if (vehicleFilter && h.vehicleId !== vehicleFilter) return false
    if (dateFrom && h.date < dateFrom) return false
    if (dateTo && h.date > dateTo) return false
    return true
  })

  const innerTabs: [string, string][] = [
    ['repair', 'ประวัติการซ่อม'],
    ['lines', 'รายละเอียดรายการ'],
    ['monthly', 'ค่าใช้จ่ายรายเดือน'],
    ['ap', 'เจ้าหนี้รายเดือน'],
    ['pivot', 'Pivot รถ × ร้านค้า'],
  ]

  return (
    <div className="card">
      <div style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="tabs" style={{ margin: 0, border: 'none', padding: '0 20px' }}>
          {innerTabs.map(([k, l]) => (
            <button key={k} className={`tab ${innerTab === k ? 'active' : ''}`} onClick={() => setInnerTab(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {innerTab === 'repair' && (
        <>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <div className="row" style={{ gap: 14, alignItems: 'flex-end' }}>
              <Field label="จากวันที่">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 180 }} />
              </Field>
              <Field label="ถึงวันที่">
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: 180 }} />
              </Field>
              <Field label="ทะเบียนรถ">
                <select
                  value={vehicleFilter}
                  onChange={(e) => setVehicleFilter(e.target.value)}
                  style={{ width: 160 }}
                >
                  <option value="">ทั้งหมด</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ทะเบียนรถ</th>
                  <th>ประเภทรถ</th>
                  <th>ช่าง / ร้านค้า</th>
                  <th>ประเภท</th>
                  <th className="right">จำนวนเงิน</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filteredHeaders.map((h) => {
                  const v = db.get<Vehicle>('vehicles', h.vehicleId)
                  const p = db.get<Partner>('partners', h.partnerId)
                  return (
                    <tr key={h.id}>
                      <td className="num muted">{db.thaiDate(h.date)}</td>
                      <td>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">
                          {v?.plate}
                        </span>
                      </td>
                      <td>{v?.type}</td>
                      <td>{p?.name}</td>
                      <td>
                        <span className="badge violet">{p?.type}</span>
                      </td>
                      <td className="num right" style={{ fontWeight: 600 }}>
                        {db.fmt(h.total)} ฿
                      </td>
                      <td>
                        {h.paid ? (
                          <span className="badge green">ชำระแล้ว</span>
                        ) : (
                          <span className="badge amber">ค้างชำระ</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--primary-50)', fontWeight: 700 }}>
                  <td colSpan={5} className="right">
                    รวม
                  </td>
                  <td className="num right">{db.fmt(filteredHeaders.reduce((s, h) => s + h.total, 0))} ฿</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {innerTab !== 'repair' && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Icon name="chart" size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>
            รายงาน
            {innerTab === 'lines'
              ? 'รายละเอียดรายการ'
              : innerTab === 'monthly'
                ? 'ค่าใช้จ่ายรายเดือน'
                : innerTab === 'ap'
                  ? 'เจ้าหนี้รายเดือน'
                  : 'Pivot รถ × ร้านค้า'}{' '}
            — อยู่ในระหว่างเตรียมข้อมูล
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 5: ทะเบียนร้านค้า / ช่าง ────────────────────────────────────────────

function typeColor(t: string): string {
  if (t.includes('ช่าง')) return 'violet'
  if (t.includes('อะไหล่')) return 'amber'
  if (t.includes('คลัง')) return 'blue'
  return 'gray'
}

const PARTNER_TYPES = ['ช่างภายนอก', 'ร้านอะไหล่', 'ร้านค้าทั่วไป', 'คลัง KPS', 'อื่นๆ']

function VendorEditModal({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !partner
  const partners = db.getAll<Partner>('partners')
  const nextCode = isNew
    ? 'VND-' + String(
        partners.reduce((max, p) => {
          const n = parseInt(p.code.replace(/\D/g, ''), 10)
          return isNaN(n) ? max : Math.max(max, n)
        }, 0) + 1,
      ).padStart(3, '0')
    : partner!.code

  const [form, setForm] = useState({
    code: nextCode,
    name: partner?.name ?? '',
    type: partner?.type ?? PARTNER_TYPES[0],
    contact: partner?.contact ?? '',
    phone: partner?.phone ?? '',
    address: partner?.address ?? '',
    taxId: partner?.taxId ?? '',
    bank: partner?.bank ?? '',
    account: partner?.account ?? '',
    accountName: partner?.accountName ?? '',
    status: partner?.status ?? 'active',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.name.trim()) { alert('กรุณากรอกชื่อร้านค้า/ช่าง'); return }
    if (isNew) {
      db.add<Partner>('partners', { ...form, id: uid('pa'), balance: 0 })
    } else {
      db.update<Partner>('partners', partner!.id, form)
    }
    onSaved()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div className="card" style={{ width: 680, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {isNew ? 'เพิ่มร้านค้า/ช่างใหม่' : 'แก้ไขข้อมูล ' + partner!.name}
          </h3>
          <button className="btn ghost icon sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="รหัส">
              <input value={form.code} readOnly style={{ background: 'var(--bg-2)', color: 'var(--text-muted)' }} />
            </Field>
            <Field label="ประเภท">
              <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                {PARTNER_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="ชื่อร้านค้า / ช่าง *">
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น ศูนย์ซ่อม ABC" />
            </Field>
            <Field label="ผู้ติดต่อ">
              <input value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="ชื่อผู้ติดต่อ" />
            </Field>
            <Field label="เบอร์โทรศัพท์">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="02-xxx-xxxx" />
            </Field>
            <Field label="เลขผู้เสียภาษี">
              <input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="13 หลัก" />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="ที่อยู่">
              <textarea
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                rows={2}
                placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
          </div>
          <h4 style={{ margin: '18px 0 10px', fontSize: 14, fontWeight: 600 }}>ข้อมูลธนาคาร (สำหรับโอนเงิน)</h4>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="ชื่อธนาคาร">
              <select value={form.bank} onChange={(e) => set('bank', e.target.value)}>
                <option value="">-- เลือกธนาคาร --</option>
                <option>ธนาคารกสิกรไทย</option>
                <option>ธนาคารไทยพาณิชย์</option>
                <option>ธนาคารกรุงเทพ</option>
                <option>ธนาคารกรุงไทย</option>
                <option>ธนาคารกรุงศรีอยุธยา</option>
                <option>ธนาคารทหารไทยธนชาต</option>
                <option>ธนาคารออมสิน</option>
                <option>—</option>
              </select>
            </Field>
            <Field label="เลขที่บัญชี">
              <input value={form.account} onChange={(e) => set('account', e.target.value)} placeholder="xxx-x-xxxxx-x" />
            </Field>
            <Field label="ชื่อบัญชี">
              <input value={form.accountName} onChange={(e) => set('accountName', e.target.value)} placeholder="ชื่อบัญชีตามสมุดบัญชี" />
            </Field>
            <Field label="สถานะ">
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ระงับ</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save}>
            <Icon name="check" size={14} /> {isNew ? 'เพิ่ม' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExpVendors() {
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)
  const partners = useMemo(() => { void tick; return db.getAll<Partner>('partners') }, [tick])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Partner | null>(null)
  const [addNew, setAddNew] = useState(false)

  const filtered = partners.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.phone.includes(q) ||
      (p.taxId && p.taxId.includes(q)) ||
      (p.account && p.account.includes(q)),
  )

  const handleDelete = (p: Partner) => {
    if (!confirm(`ต้องการลบ "${p.name}" หรือไม่?`)) return
    db.remove('partners', p.id)
    refresh()
  }

  return (
    <div className="card">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="row">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ทะเบียนร้านค้า / ช่าง</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              จัดการรายชื่อช่างและร้านค้าที่ใช้บริการ
            </div>
          </div>
          <div className="spacer" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา ชื่อ / เบอร์โทร / เลขผู้เสียภาษี..."
            style={{
              height: 34,
              padding: '0 12px',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--bg)',
              fontSize: 13,
              width: 280,
            }}
          />
          <button className="btn primary" onClick={() => setAddNew(true)}>
            <Icon name="plus" size={14} /> เพิ่มใหม่
          </button>
        </div>
      </div>

      <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ชื่อร้านค้า / ช่าง</th>
              <th>ประเภท</th>
              <th>เบอร์โทร</th>
              <th>ที่อยู่</th>
              <th>ธนาคาร / บัญชี</th>
              <th>เลขผู้เสียภาษี</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div className="muted mono" style={{ fontSize: 11 }}>{p.code}</div>
                </td>
                <td>
                  <span className={`badge ${typeColor(p.type)}`}>{p.type}</span>
                </td>
                <td className="mono">{p.phone || '—'}</td>
                <td style={{ maxWidth: 240, fontSize: 12.5 }}>
                  {p.address || <span className="muted">—</span>}
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {p.bank && p.bank !== '—' ? (
                    <>
                      <div>{p.bank}</div>
                      <div className="mono muted" style={{ fontSize: 11.5 }}>{p.account}</div>
                      {p.accountName && p.accountName !== '—' && (
                        <div className="muted" style={{ fontSize: 11 }}>{p.accountName}</div>
                      )}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="mono muted">{p.taxId || '—'}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn ghost icon sm" onClick={() => setEditing(p)} title="แก้ไข">
                      <Icon name="edit" size={13} />
                    </button>
                    <button className="btn ghost icon sm danger" onClick={() => handleDelete(p)} title="ลบ">
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty">ไม่พบข้อมูล</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <VendorEditModal partner={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
      {addNew && (
        <VendorEditModal partner={null} onClose={() => setAddNew(false)} onSaved={refresh} />
      )}
    </div>
  )
}
