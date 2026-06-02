import React, { useState, useMemo, useEffect, useRef } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { Icon, Field, Info, SearchInput } from '../../components/ui'
import { usePrint } from '../../hooks/usePrint'
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
const isKPSPartner = (partnerId: string, partners: Partner[]): boolean => {
  const p = partners.find((x) => x.id === partnerId)
  return !!p && p.name.replace(/\s+/g, '') === KPS_WAREHOUSE_NAME.replace(/\s+/g, '')
}

// Build stock movement patches for KPS warehouse expense lines.
// sign = -1 to deduct (when adding/editing an expense), +1 to revert (when removing/editing)
// Returns [{ id, patch }] to be applied via useUpdate.mutateAsync in the calling handler.
const buildStockDeltas = (
  lines: { stockItemId?: string; qty: number }[],
  sign: 1 | -1,
  stocks: StockItem[],
): { id: string; patch: Partial<StockItem> }[] => {
  const patches: { id: string; patch: Partial<StockItem> }[] = []
  lines.forEach((l) => {
    if (!l.stockItemId) return
    const s = stocks.find((x) => x.id === l.stockItemId)
    if (!s) return
    const q = +l.qty || 0
    patches.push({
      id: s.id,
      patch: {
        qty: s.qty + sign * q,
        qtyOut: s.qtyOut - sign * q,
      },
    })
  })
  return patches
}

function genExpCode(headers: ExpenseHeader[]): string {
  const now = new Date()
  const yyyymmdd = String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const prefix = `EXP-${yyyymmdd}-`
  const existing = headers.filter(h => h.code.startsWith(prefix))
  // length+1 leaves gaps when an expense is deleted and collides with a live row.
  const maxSeq = existing.reduce((max, h) => {
    const n = parseInt(h.code.slice(prefix.length), 10)
    return Number.isNaN(n) ? max : Math.max(max, n)
  }, 0)
  return prefix + String(maxSeq + 1).padStart(3, '0')
}
function toBeCode(code: string): string {
  return code.replace(/^EXP-(\d{4})/, (_, y) => `EXP-${+y + 543}`)
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
            ['record', '', 'บันทึกค่าใช้จ่าย', 'edit'],
            ['finance', 'finance', 'สถานะการเงิน', 'money'],
            ['stock', 'stock', 'สต็อคคลัง KPS', 'package'],
            ['report', 'report', 'รายงานสรุป', 'chart'],
            ['vendors', 'vendors', 'ทะเบียนร้านค้า/ช่าง', 'client'],
          ] as [string, string, string, string][]
        ).map(([id, route, label, ic]) => (
          <button
            key={id}
            className={`tab ${current === id ? 'active' : ''}`}
            onClick={() => setActive('expenses' + (route ? '.' + route : ''))}
          >
            <Icon name={ic} size={14} style={{ marginRight: 6, verticalAlign: -3 }} />
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
  docCode,
}: {
  hdr: HeaderForm
  setHdr: (next: HeaderForm) => void
  lines: LineItem[]
  setLines: (next: LineItem[]) => void
  vehicles: Vehicle[]
  partners: Partner[]
  stocks: StockItem[]
  docCode?: string
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

  const isKPS = isKPSPartner(hdr.partnerId, partners)
  const totals = lines.map((l) => (l.qty || 0) * (l.unitPrice || 0))
  const netTotal = totals.reduce((s, t) => s + t, 0)

  // Auto-fill from selected stock item — use sellPrice if set, otherwise fall back to unitCost
  const pickStock = (i: number, stockId: string) => {
    const s = stocks.find((x) => x.id === stockId)
    setLines(
      lines.map((l, idx) =>
        idx === i
          ? {
              ...l,
              stockItemId: stockId,
              item: s?.name ?? '',
              unitPrice: s?.sellPrice ?? s?.unitCost ?? 0,
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
          <div className="grid-2" style={{ gap: 16, marginBottom: 16, alignItems: 'start' }}>
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
              <div style={{
                height: 38, display: 'flex', alignItems: 'center', gap: 20,
                padding: '0 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: '#fff',
              }}>
                <label className="row" style={{ gap: 7, cursor: 'pointer', fontSize: 13.5 }}>
                  <input
                    type="radio"
                    name="ex-paid"
                    checked={hdr.paid === 'unpaid'}
                    onChange={() => setH('paid', 'unpaid')}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>ยังไม่ชำระ</span>
                </label>
                <label className="row" style={{ gap: 7, cursor: 'pointer', fontSize: 13.5 }}>
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

          <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {docCode && (
              <div style={{ flex: '0 0 260px', minWidth: 220 }}>
                <Field label="เลขที่เอกสาร (อัตโนมัติ)">
                  <input
                    readOnly
                    value={toBeCode(docCode)}
                    style={{
                      width: '100%', height: 44,
                      background: 'var(--bg-sunk)', color: 'var(--text-muted)',
                      cursor: 'default', borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
                      padding: '0 14px', fontSize: 13, fontFamily: 'var(--mono)',
                    }}
                  />
                </Field>
              </div>
            )}
            <div
              style={{
                flex: 1, minWidth: 240, height: 44,
                padding: '0 18px',
                background: 'var(--primary-50)',
                borderRadius: 'var(--r-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontWeight: 600 }}>ยอดรวมสุทธิ</span>
              <div className="spacer" />
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
                {netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
              </span>
            </div>
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
                              ทุน {db.fmt(stk.unitCost)} ฿
                              {stk.sellPrice != null && (
                                <span style={{ color: '#0369A1', marginLeft: 6 }}>
                                  · ขาย {db.fmt(stk.sellPrice)} ฿/{stk.unit}
                                </span>
                              )}
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
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: partners = [] } = useList<Partner>('partners')
  const { data: stocks = [] } = useList<StockItem>('stock_items')
  const { data: allHeaders = [] } = useList<ExpenseHeader>('expense_headers')
  const insertHeader = useInsert<ExpenseHeader>('expense_headers')
  const insertLine = useInsert<ExpenseLine>('expense_lines')
  const updateStock = useUpdate<StockItem>('stock_items')

  const recent = useMemo(() => allHeaders.slice(0, 8), [allHeaders])

  const [hdr, setHdr] = useState<HeaderForm>(emptyHeader())
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [editing, setEditing] = useState<ExpenseHeader | null>(null)
  const [docCode] = useState(() => genExpCode(allHeaders))

  const handleSave = async () => {
    if (!hdr.vehicleId || !hdr.partnerId) {
      alert('กรุณาเลือกรถและช่าง/ร้านค้า')
      return
    }
    if (lines.length === 0 || lines.every((l) => !l.item && !l.stockItemId)) {
      alert('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ')
      return
    }
    try {
      const netTotal = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0)
      const h = await insertHeader.mutateAsync({
        code: genExpCode(allHeaders),
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
      for (const l of lines) {
        const { id: _id, ...rest } = l
        void _id
        await insertLine.mutateAsync({
          ...rest,
          headerId: h.id,
          amount: (l.qty || 0) * (l.unitPrice || 0),
        })
      }
      // Apply stock deduction for KPS warehouse
      if (isKPSPartner(hdr.partnerId, partners)) {
        for (const d of buildStockDeltas(lines, -1, stocks)) {
          await updateStock.mutateAsync(d)
        }
      }
      alert('บันทึกเรียบร้อย')
      setHdr(emptyHeader())
      setLines([emptyLine()])
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
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
        docCode={docCode}
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
                      {vehicles.find((v) => v.id === h.vehicleId)?.plate ?? '—'}
                    </span>
                  </td>
                  <td>{partners.find((p) => p.id === h.partnerId)?.name ?? '—'}</td>
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
          onSaved={() => {}}
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
  const { data: allLines = [], isLoading } = useList<ExpenseLine>('expense_lines')
  const updateHeader = useUpdate<ExpenseHeader>('expense_headers')
  const insertLine = useInsert<ExpenseLine>('expense_lines')
  const deleteLine = useDelete('expense_lines')
  const updateStock = useUpdate<StockItem>('stock_items')
  const oldLines = useMemo(
    () => allLines.filter((l) => l.headerId === header.id),
    [allLines, header.id],
  )
  const wasKPS = isKPSPartner(header.partnerId, partners)

  const [hdr, setHdr] = useState<HeaderForm>({
    vehicleId: header.vehicleId,
    partnerId: header.partnerId,
    date: header.date,
    odometer: String(header.odometer || ''),
    paid: header.paid ? 'paid' : 'unpaid',
    dueDate: header.dueDate,
  })
  // Existing lines load asynchronously via useList — initialise the editable
  // rows once the query has resolved (otherwise they'd capture an empty list).
  const [lines, setLines] = useState<LineItem[]>([])
  const linesInited = useRef(false)
  useEffect(() => {
    if (linesInited.current || isLoading) return
    linesInited.current = true
    setLines(oldLines.map((l) => ({
      id: l.id,
      invoiceNo: l.invoiceNo,
      item: l.item,
      category: l.category,
      qty: l.qty,
      unitPrice: l.unitPrice,
      note: l.note,
      stockItemId: l.stockItemId,
    })))
  }, [isLoading, oldLines])

  const handleSave = async () => {
    if (!hdr.vehicleId || !hdr.partnerId) {
      alert('กรุณาเลือกรถและช่าง/ร้านค้า')
      return
    }
    try {
      const netTotal = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0)

      // Revert old stock impact
      if (wasKPS) {
        for (const d of buildStockDeltas(oldLines, +1, stocks)) {
          await updateStock.mutateAsync(d)
        }
      }

      // Remove old lines
      for (const l of oldLines) {
        await deleteLine.mutateAsync(l.id)
      }

      // Update header
      await updateHeader.mutateAsync({
        id: header.id,
        patch: {
          ...hdr,
          paid: hdr.paid === 'paid',
          odometer: Number(hdr.odometer) || 0,
          total: netTotal,
          lineCount: lines.length,
          note: lines.map((l) => l.item).filter(Boolean).join(', '),
        },
      })

      // Add new lines
      for (const l of lines) {
        const { id: _id, ...rest } = l
        void _id
        await insertLine.mutateAsync({
          ...rest,
          headerId: header.id,
          amount: (l.qty || 0) * (l.unitPrice || 0),
        })
      }

      // Apply new stock impact
      if (isKPSPartner(hdr.partnerId, partners)) {
        for (const d of buildStockDeltas(lines, -1, stocks)) {
          await updateStock.mutateAsync(d)
        }
      }

      alert('บันทึกการแก้ไขเรียบร้อย')
      onSaved()
      onClose()
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
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
            docCode={header.code}
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
  const updateHeader = useUpdate<ExpenseHeader>('expense_headers')
  const confirm = async () => {
    await updateHeader.mutateAsync({ id: header.id, patch: { paid: true } })
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
      <div className="card" style={{ width: 600, maxWidth: '96vw', background: '#ffffff' }}>
        <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>ยืนยันการชำระเงิน</h3>
          <button className="btn ghost icon sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text-2)' }}>
            ตรวจสอบยอดก่อนยืนยัน เมื่อบันทึกแล้วสถานะจะเปลี่ยนเป็น{' '}
            <strong style={{ color: 'var(--green)' }}>ชำระแล้ว</strong>
          </p>
          <div style={{ padding: '18px 20px', background: 'var(--bg, #F8FAFC)', borderRadius: 10 }}>
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
  const { data: headers = [] } = useList<ExpenseHeader>('expense_headers')
  const { data: partners = [] } = useList<Partner>('partners')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: stocks = [] } = useList<StockItem>('stock_items')
  const [editing, setEditing] = useState<ExpenseHeader | null>(null)

  const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()
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
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn sm" onClick={() => setEditing(h)} title="แก้ไขรายการ/ราคา">
                          <Icon name="edit" size={12} /> แก้ไข
                        </button>
                        <button
                          className="btn sm"
                          style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }}
                          onClick={() => setPayTarget(h)}
                        >
                          <Icon name="money" size={12} /> บันทึกชำระ
                        </button>
                      </div>
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
          onPaid={() => {}}
        />
      )}

      {editing && (
        <ExpenseEditModal
          header={editing}
          vehicles={vehicles}
          partners={partners}
          stocks={stocks}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ─── Tab 3: สต๊อคคลัง KPS ────────────────────────────────────────────────────
// ─── Tab 3: สต๊อคคลัง KPS ────────────────────────────────────────────────────

function SellPriceCell({ item, onSaved }: { item: StockItem; onSaved: () => void }) {
  const updateStock = useUpdate<StockItem>('stock_items')
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const start = () => {
    setVal(item.sellPrice != null ? String(item.sellPrice) : '')
    setEditing(true)
  }
  const save = async () => {
    const p = parseFloat(val)
    await updateStock.mutateAsync({ id: item.id, patch: { sellPrice: isNaN(p) ? undefined : p } })
    setEditing(false)
    onSaved()
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={{ width: 90, textAlign: 'right', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--primary)', fontSize: 12, fontFamily: 'var(--mono)' }}
        placeholder="0.00"
      />
    )
  }

  return (
    <div
      onClick={start}
      title="คลิกเพื่อตั้งราคาขาย"
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
    >
      {item.sellPrice != null
        ? <span className="mono">{item.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>— ตั้งราคา</span>}
      <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}><Icon name="edit" size={11} /></span>
    </div>
  )
}

function ReorderCell({ item, onSaved }: { item: StockItem; onSaved: () => void }) {
  const updateStock = useUpdate<StockItem>('stock_items')
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const start = () => { setVal(String(item.reorderAt ?? 0)); setEditing(true) }
  const save = async () => {
    const n = parseFloat(val)
    await updateStock.mutateAsync({ id: item.id, patch: { reorderAt: isNaN(n) ? 0 : n } })
    setEditing(false)
    onSaved()
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={{ width: 80, textAlign: 'right', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--primary)', fontSize: 12, fontFamily: 'var(--mono)' }}
        placeholder="0"
      />
    )
  }

  return (
    <div
      onClick={start}
      title="คลิกเพื่อตั้งจุดเตือนสต๊อกต่ำ"
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
    >
      <span className="mono">{item.reorderAt ?? 0}</span>
      <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}><Icon name="edit" size={11} /></span>
    </div>
  )
}

function ExpStock() {
  const { data: stock = [] } = useList<StockItem>('stock_items')
  const { data: receipts = [] } = useList<StockReceipt>('stock_receipts')
  const { data: allPartners = [] } = useList<Partner>('partners')
  const { data: allHeaders = [] } = useList<ExpenseHeader>('expense_headers')
  const { data: allExpLines = [] } = useList<ExpenseLine>('expense_lines')
  const updateStock = useUpdate<StockItem>('stock_items')
  const insertStock = useInsert<StockItem>('stock_items')
  const insertReceipt = useInsert<StockReceipt>('stock_receipts')
  const insertPartner = useInsert<Partner>('partners')
  const partners = allPartners.filter((p) => p.name !== KPS_WAREHOUSE_NAME)

  const total = stock.reduce((s, r) => s + r.qty * r.unitCost, 0)
  const low = stock.filter((s) => s.qty <= s.reorderAt)

  // Net profit this month: sum over KPS expense lines of qty * (sellPrice - unitCost)
  const thisMonthProfit = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const headers = allHeaders.filter(h => {
      if (!isKPSPartner(h.partnerId, allPartners)) return false
      return h.date?.slice(0, 7) === ym
    })
    const headerIds = new Set(headers.map(h => h.id))
    return allExpLines
      .filter(l => headerIds.has(l.headerId) && l.stockItemId)
      .reduce((sum, l) => {
        const s = stock.find(x => x.id === l.stockItemId)
        if (!s || s.sellPrice == null) return sum
        return sum + l.qty * (s.sellPrice - s.unitCost)
      }, 0)
  }, [allHeaders, allExpLines, allPartners, stock])

  // Receive form state
  const today = new Date().toISOString().slice(0, 10)
  const emptyReceive = {
    date: today,
    partnerId: '',
    stockItemId: '',
    qty: '',
    unitPrice: '',
    newName: '',
    newUnit: '',
    newCategory: 'อะไหล่',
    newPartnerName: '',
    newPartnerType: PARTNER_TYPES[0],
  }
  const [form, setForm] = useState(emptyReceive)
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const formTotal = (parseFloat(form.qty) || 0) * (parseFloat(form.unitPrice) || 0)
  const isNewItem = form.stockItemId === '__new__'
  const isNewPartner = form.partnerId === '__new__'

  const onPickItem = (id: string) => {
    if (id === '__new__') { setForm((f) => ({ ...f, stockItemId: '__new__' })); return }
    const s = stock.find((x) => x.id === id)
    setForm((f) => ({ ...f, stockItemId: id, unitPrice: f.unitPrice || (s ? String(s.unitCost) : '') }))
  }

  const submitReceipt = async () => {
    if (!form.partnerId) { alert('กรุณาเลือกคู่ค้า'); return }
    if (!form.stockItemId) { alert('กรุณาเลือกรายการสินค้า'); return }
    const q = parseFloat(form.qty) || 0
    const p = parseFloat(form.unitPrice) || 0
    if (q <= 0) { alert('กรุณากรอกจำนวน'); return }
    if (p <= 0) { alert('กรุณากรอกราคาต่อหน่วย'); return }
    if (isNewPartner && !form.newPartnerName.trim()) { alert('กรุณากรอกชื่อคู่ค้าใหม่'); return }
    if (isNewItem    && !form.newName.trim())        { alert('กรุณากรอกชื่อสินค้าใหม่'); return }

    try {
      // New vendor: create it in the shared partners registry first.
      let partnerId = form.partnerId
      if (isNewPartner) {
        const nextNum = allPartners.reduce((max, x) => {
          const n = parseInt(x.code.replace(/\D/g, ''), 10)
          return isNaN(n) ? max : Math.max(max, n)
        }, 0) + 1
        const createdPartner = await insertPartner.mutateAsync({
          code: 'VND-' + String(nextNum).padStart(3, '0'),
          name: form.newPartnerName.trim(),
          type: form.newPartnerType,
          status: 'active',
        })
        partnerId = createdPartner.id
      }

      // New stock item: create it first, then receive into it.
      if (isNewItem) {
        const created = await insertStock.mutateAsync({
          code: 'ST-' + Date.now().toString().slice(-6),
          name: form.newName.trim(),
          category: form.newCategory,
          unit: form.newUnit.trim() || 'ชิ้น',
          qtyIn: q, qtyOut: 0, qty: q,
          unitCost: p, reorderAt: 0,
        })
        await insertReceipt.mutateAsync({
          date: form.date, partnerId, stockItemId: created.id,
          qty: q, unitPrice: p, total: q * p,
        })
        alert('เพิ่มสินค้าใหม่และรับเข้าคลังเรียบร้อย')
        setForm(emptyReceive)
        return
      }

      const s = stock.find((x) => x.id === form.stockItemId)
      if (!s) return

      // Weighted average cost
      const oldValue = s.qty * s.unitCost
      const newValue = q * p
      const newQty = s.qty + q
      const newAvgCost = newQty > 0 ? (oldValue + newValue) / newQty : p

      await updateStock.mutateAsync({
        id: s.id,
        patch: {
          qty: newQty,
          qtyIn: s.qtyIn + q,
          unitCost: Math.round(newAvgCost * 100) / 100,
        },
      })

      await insertReceipt.mutateAsync({
        date: form.date,
        partnerId,
        stockItemId: s.id,
        qty: q,
        unitPrice: p,
        total: q * p,
      })

      alert('รับสินค้าเข้าคลังเรียบร้อย')
      setForm(emptyReceive)
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">รายการสินค้า</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
            {stock.length} <span style={{ fontSize: 14, fontWeight: 500 }}>รายการ</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">มูลค่าสต๊อคทั้งหมด</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--primary)' }}>
            {db.fmt(total)} ฿
          </div>
        </div>
        <div className="card kpi">
          <div className="label">สินค้าหมด / ต่ำ</div>
          <div
            className="mono"
            style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: low.length > 0 ? 'var(--red)' : 'var(--green)' }}
          >
            {low.length} <span style={{ fontSize: 14, fontWeight: 500 }}>รายการ</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">กำไรสุทธิเดือนนี้</div>
          <div
            className="mono"
            style={{ fontSize: 22, fontWeight: 700, marginTop: 8, color: thisMonthProfit >= 0 ? '#10B981' : '#EF4444' }}
          >
            {thisMonthProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>฿</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {thisMonthProfit >= 0 ? 'กำไร' : 'ขาดทุน'} จากราคาขาย KPS
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
                <option value="__new__">➕ เพิ่มคู่ค้าใหม่...</option>
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
                <option value="__new__">➕ เพิ่มสินค้าใหม่...</option>
              </select>
            </Field>
          </div>
          {isNewPartner && (
            <div className="grid-2" style={{ gap: 14, marginBottom: 14, padding: 12, background: 'var(--bg-sunk)', borderRadius: 8 }}>
              <Field label="ชื่อคู่ค้าใหม่ *">
                <input value={form.newPartnerName} onChange={(e) => set('newPartnerName', e.target.value)} placeholder="เช่น ร้านอะไหล่ ABC" />
              </Field>
              <Field label="ประเภท">
                <select value={form.newPartnerType} onChange={(e) => set('newPartnerType', e.target.value)}>
                  {PARTNER_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          )}
          {isNewItem && (
            <div className="grid-3" style={{ gap: 14, marginBottom: 14, padding: 12, background: 'var(--bg-sunk)', borderRadius: 8 }}>
              <Field label="ชื่อสินค้าใหม่ *">
                <input value={form.newName} onChange={(e) => set('newName', e.target.value)} placeholder="เช่น ไส้กรองอากาศ" />
              </Field>
              <Field label="หน่วย">
                <input value={form.newUnit} onChange={(e) => set('newUnit', e.target.value)} placeholder="เช่น ชิ้น / ลิตร" />
              </Field>
              <Field label="หมวดหมู่">
                <select value={form.newCategory} onChange={(e) => set('newCategory', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          )}
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
              onClick={() => setForm(emptyReceive)}
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
                <th className="right">จุดเตือนต่ำ</th>
                <th className="right">ราคาทุน / หน่วย</th>
                <th className="right" style={{ color: '#0369A1' }}>ราคาขาย / หน่วย</th>
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
                  <td className="num right">
                    <ReorderCell item={s} onSaved={() => {}} />
                  </td>
                  <td className="num right">{db.fmt(s.unitCost)} ฿</td>
                  <td className="num right" style={{ color: '#0369A1' }}>
                    <SellPriceCell item={s} onSaved={() => {}} />
                  </td>
                  <td className="num right" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {db.fmt(s.qty * s.unitCost)} ฿
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--green-50)', fontWeight: 700 }}>
                <td colSpan={6} className="right">
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
                      <td>{allPartners.find((p) => p.id === r.partnerId)?.name ?? '—'}</td>
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

// ─── PivotTab ─────────────────────────────────────────────────────────────────

const PIVOT_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function PivotTab() {
  const today = new Date()
  const { print } = usePrint()
  const { data: allHeaders = [] } = useList<ExpenseHeader>('expense_headers')
  const { data: allPartners = [] } = useList<Partner>('partners')
  const { data: allVehicles = [] } = useList<Vehicle>('vehicles')
  const [pivotYear,  setPivotYear]  = useState(today.getFullYear())
  const [pivotMonth, setPivotMonth] = useState<number>(today.getMonth() + 1) // 1-12, 0 = ทุกเดือน

  const yearOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => 2025 + i), [])

  // Compute CE date range from BE display values
  const dateFrom = pivotMonth > 0
    ? `${pivotYear}-${String(pivotMonth).padStart(2, '0')}-01`
    : `${pivotYear}-01-01`
  const dateTo = pivotMonth > 0
    ? `${pivotYear}-${String(pivotMonth).padStart(2, '0')}-${new Date(pivotYear, pivotMonth, 0).getDate()}`
    : `${pivotYear}-12-31`

  const periodLabel = pivotMonth > 0
    ? `${PIVOT_MONTHS[pivotMonth - 1]} พ.ศ. ${pivotYear + 543}`
    : `ทั้งปี พ.ศ. ${pivotYear + 543}`

  const headers = useMemo(
    () => allHeaders.filter(h => h.date >= dateFrom && h.date <= dateTo),
    [allHeaders, dateFrom, dateTo],
  )

  const activeVendorIds = useMemo(() => Array.from(new Set(headers.map(h => h.partnerId))), [headers])
  const activeVendors   = useMemo(
    () => activeVendorIds.map(id => allPartners.find(p => p.id === id)).filter(Boolean) as Partner[],
    [activeVendorIds, allPartners],
  )
  const vehicles = allVehicles

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const h of headers) {
      if (!m[h.vehicleId]) m[h.vehicleId] = {}
      m[h.vehicleId][h.partnerId] = (m[h.vehicleId][h.partnerId] ?? 0) + h.total
    }
    return m
  }, [headers])

  const rowTotal  = (vid: string) => Object.values(matrix[vid] ?? {}).reduce((s, v) => s + v, 0)
  const colTotal  = (pid: string) => Object.values(matrix).reduce((s, row) => s + (row[pid] ?? 0), 0)
  const grandTotal = activeVendorIds.reduce((s, pid) => s + colTotal(pid), 0)
  const fmtMoney  = (n: number) => {
    if (n <= 0) return ''
    const cents = Math.round(n * 100) % 100
    // .00 → ซ่อนทศนิยม / .99 → ปัดขึ้นเป็นจำนวนเต็ม (Math.round จัดการ .99 → +1 ให้แล้ว)
    if (cents === 0 || cents === 99) {
      return Math.round(n).toLocaleString('en-US')
    }
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const activeVehicles = vehicles.filter(v => matrix[v.id])

  const selStyle: React.CSSProperties = {
    height: 38, padding: '0 12px', borderRadius: 8,
    border: '1px solid #CBD5E1', background: '#ffffff', fontSize: 13,
    outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      {/* ── Filter bar ── */}
      <div
        className="no-print"
        style={{
          padding: '14px 20px', borderBottom: '1px solid var(--line)',
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          background: '#FAFAFA',
        }}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>เดือน</span>
          <select value={pivotMonth} onChange={e => setPivotMonth(Number(e.target.value))} style={{ ...selStyle, minWidth: 140 }}>
            <option value={0}>ทุกเดือน</option>
            {PIVOT_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ปี พ.ศ.</span>
          <select value={pivotYear} onChange={e => setPivotYear(Number(e.target.value))} style={{ ...selStyle, minWidth: 110 }}>
            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>

        <div style={{
          background: '#EFF6FF', color: '#1D4ED8', borderRadius: 8,
          padding: '5px 12px', fontSize: 12, fontWeight: 600,
        }}>
          {periodLabel}
        </div>

        <div style={{ display: 'flex', gap: 20, marginLeft: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            รถที่มีรายจ่าย <strong style={{ color: 'var(--text)' }}>{activeVehicles.length} คัน</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            คู่ค้า <strong style={{ color: 'var(--text)' }}>{activeVendors.length} ราย</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            ยอดรวม <strong style={{ color: 'var(--primary)' }}>
              ฿{fmtMoney(grandTotal)}
            </strong>
          </span>
        </div>

        <button
          className="btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => print('landscape')}
        >
          <Icon name="download" size={14} /> พิมพ์รายงาน
        </button>
      </div>

      {/* ── Print header (matches P&L รายคัน) ── */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>
          รายงานสรุปค่าใช้จ่ายรายคัน × คู่ค้า — {periodLabel}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 4 }}>
          KPS Transportation ERP · {activeVehicles.length} คัน · {activeVendors.length} คู่ค้า
        </div>
      </div>

      {/* ── Pivot table (shown on both screen and print) ── */}
      <div style={{ margin: 16 }}>
        {activeVendors.length === 0 ? (
          <div className="no-print" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Icon name="chart" size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>ไม่มีข้อมูลค่าใช้จ่ายใน{periodLabel}</div>
          </div>
        ) : (
          <div className="card print-area" style={{ background: '#ffffff', overflow: 'hidden' }}>
            <div className="head no-print" style={{ paddingBottom: 0 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="chart" size={16} />
                ตารางสรุปค่าใช้จ่ายรายคัน × คู่ค้า
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                  ({activeVehicles.length} คัน · {activeVendors.length} คู่ค้า)
                </span>
              </h3>
            </div>
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="tbl pivot-tbl">
                <thead>
                  <tr>
                    <th style={{ minWidth: 110 }}>ทะเบียนรถ</th>
                    {activeVendors.map(p => (
                      <th key={p.id} className="num right" style={{ minWidth: 120, whiteSpace: 'nowrap' }}>
                        {p.name}
                      </th>
                    ))}
                    <th className="num right" style={{ minWidth: 120, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                      รวมต่อคัน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeVehicles.map(v => (
                    <tr key={v.id}>
                      <td>
                        <div className="mono" style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 12 }}>{v.plate}</div>
                        <div className="no-print" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.type}</div>
                      </td>
                      {activeVendors.map(p => (
                        <td key={p.id} className="num right mono" style={{ fontSize: 12 }}>
                          {fmtMoney(matrix[v.id]?.[p.id] ?? 0)}
                        </td>
                      ))}
                      <td className="num right mono" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>
                        {fmtMoney(rowTotal(v.id))}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-2, #F1F5F9)', fontWeight: 700 }}>
                    <td>รวมต่อคู่ค้า</td>
                    {activeVendors.map(p => (
                      <td key={p.id} className="num right mono" style={{ fontSize: 12 }}>
                        {fmtMoney(colTotal(p.id))}
                      </td>
                    ))}
                    <td className="num right mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {fmtMoney(grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Print footer (matches P&L รายคัน) ── */}
      <div className="print-only" style={{ marginTop: 12, fontSize: 10, color: '#666', textAlign: 'center' }}>
        * รายงานนี้สร้างจากข้อมูล Real-time · สรุปยอดค่าใช้จ่ายรายคัน × คู่ค้า · ระบบ KPS Transportation ERP
      </div>
    </div>
  )
}

// ─── Tab 4: รายงานสรุป (Unchanged) ───────────────────────────────────────────

function ExpReport() {
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: partners = [] } = useList<Partner>('partners')
  const { data: headers = [] } = useList<ExpenseHeader>('expense_headers')
  const { data: allLines = [] } = useList<ExpenseLine>('expense_lines')
  const [innerTab, setInnerTab] = useState('repair')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [detailHeader, setDetailHeader] = useState<ExpenseHeader | null>(null)

  const filteredHeaders = headers.filter((h) => {
    if (vehicleFilter && h.vehicleId !== vehicleFilter) return false
    if (dateFrom && h.date < dateFrom) return false
    if (dateTo && h.date > dateTo) return false
    return true
  })

  const innerTabs: [string, string][] = [
    ['repair', 'ประวัติการซ่อม'],
    ['lines', 'รายละเอียดรายการ'],
    ['pivot', 'สรุปรายคัน × คู่ค้า'],
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
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, overflow: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>เลขที่เอกสาร</th>
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
                  const v = vehicles.find((x) => x.id === h.vehicleId)
                  const p = partners.find((x) => x.id === h.partnerId)
                  return (
                    <tr key={h.id}>
                      <td>
                        <button
                          className="btn ghost sm"
                          style={{ color: 'var(--primary)', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, padding: '2px 6px' }}
                          onClick={() => setDetailHeader(h)}
                        >
                          {toBeCode(h.code)}
                        </button>
                      </td>
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
                  <td colSpan={6} className="right">
                    รวม
                  </td>
                  <td className="num right">{db.fmt(filteredHeaders.reduce((s, h) => s + h.total, 0))} ฿</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          {detailHeader && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
              onClick={() => setDetailHeader(null)}
            >
              <div
                className="card"
                style={{ width: 700, maxWidth: '96vw', background: '#ffffff', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>รายละเอียดการซ่อม</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {toBeCode(detailHeader.code)} · {db.thaiDate(detailHeader.date)} · {vehicles.find((v) => v.id === detailHeader.vehicleId)?.plate ?? '—'} · {partners.find((p) => p.id === detailHeader.partnerId)?.name ?? '—'}
                    </div>
                  </div>
                  <button className="btn ghost icon sm" onClick={() => setDetailHeader(null)}><Icon name="close" size={16} /></button>
                </div>
                <div style={{ overflow: 'auto', flex: 1 }}>
                  <table className="tbl" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>รายการ</th>
                        <th>หมวด</th>
                        <th className="num right">จำนวน</th>
                        <th className="num right">ราคา/หน่วย</th>
                        <th className="num right">รวม</th>
                        <th>หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allLines.filter(l => l.headerId === detailHeader.id).map((l, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{l.item || '—'}</td>
                          <td><span className="badge gray">{l.category}</span></td>
                          <td className="num right">{l.qty}</td>
                          <td className="num right mono">{db.fmt(l.unitPrice)}</td>
                          <td className="num right mono" style={{ fontWeight: 600 }}>{db.fmt(l.amount)}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.note || '—'}</td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--bg-2, #F1F5F9)', fontWeight: 700 }}>
                        <td colSpan={4} className="right">รวมทั้งหมด</td>
                        <td className="num right mono">{db.fmt(detailHeader.total)} ฿</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {innerTab === 'lines' && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Icon name="chart" size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>รายละเอียดรายการ — อยู่ในระหว่างเตรียมข้อมูล</div>
        </div>
      )}
      {innerTab === 'pivot' && <PivotTab />}
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

const PARTNER_TYPES = ['ช่างภายนอก', 'ร้านอะไหล่', 'ร้านค้าทั่วไป', 'คลัง KPS', 'ซัพพลายเออร์น้ำมัน', 'อื่นๆ']

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
  const { data: partners = [] } = useList<Partner>('partners')
  const insertPartner = useInsert<Partner>('partners')
  const updatePartner = useUpdate<Partner>('partners')
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
  const knownTypes = [...new Set([...PARTNER_TYPES.filter(t => t !== 'อื่นๆ'), ...partners.map(p => p.type).filter(Boolean)])]

  const save = async () => {
    if (!form.name.trim()) { alert('กรุณากรอกชื่อร้านค้า/ช่าง'); return }
    try {
      if (isNew) {
        await insertPartner.mutateAsync({ ...form, balance: 0 })
      } else {
        await updatePartner.mutateAsync({ id: partner!.id, patch: form })
      }
      onSaved()
      onClose()
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
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
              <select
                value={knownTypes.includes(form.type) ? form.type : 'อื่นๆ'}
                onChange={(e) => set('type', e.target.value === 'อื่นๆ' ? '' : e.target.value)}
              >
                {knownTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="อื่นๆ">อื่นๆ (พิมพ์เอง)</option>
              </select>
              {!knownTypes.includes(form.type) && (
                <input
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  placeholder="ระบุประเภทใหม่..."
                  style={{ marginTop: 8 }}
                />
              )}
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
  const { data: partners = [] } = useList<Partner>('partners')
  const deletePartner = useDelete('partners')
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

  const handleDelete = async (p: Partner) => {
    if (!confirm(`ต้องการลบ "${p.name}" หรือไม่?`)) return
    await deletePartner.mutateAsync(p.id)
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
          <SearchInput value={q} onChange={setQ} placeholder="ค้นหา ชื่อ / เบอร์โทร / เลขผู้เสียภาษี..." width={280} />
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
        <VendorEditModal partner={editing} onClose={() => setEditing(null)} onSaved={() => {}} />
      )}
      {addNew && (
        <VendorEditModal partner={null} onClose={() => setAddNew(false)} onSaved={() => {}} />
      )}
    </div>
  )
}
