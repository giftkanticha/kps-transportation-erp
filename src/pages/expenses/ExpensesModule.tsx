import React, { useState } from 'react'
import { db } from '../../lib/db'
import { Icon, Field } from '../../components/ui'
import type { ExpenseHeader, ExpenseLine, Partner, Vehicle, StockItem } from '../../types'

interface ExpensesModuleProps {
  tab: string
  setActive: (id: string) => void
}

const CATEGORIES = ['ค่าบริการ', 'อะไหล่', 'ยาง', 'น้ำมัน', 'อื่นๆ']

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
            ['stock', 'stock', 'สต๊อคคลัง KPS'],
            ['report', 'report', 'รายงานสรุป'],
            ['vendors', 'vendors', 'ทะเบียนช่าง/ผู้ขาย'],
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
  invoiceNo: string
  item: string
  category: string
  qty: number
  unitPrice: number
  note: string
}

interface HeaderForm {
  vehicleId: string
  partnerId: string
  date: string
  odometer: string
  paid: 'paid' | 'unpaid'
  dueDate: string
}

function ExpRecord() {
  const vehicles = db.getAll<Vehicle>('vehicles')
  const partners = db.getAll<Partner>('partners')

  const [hdr, setHdr] = useState<HeaderForm>({
    vehicleId: '',
    partnerId: '',
    date: '2026-05-16',
    odometer: '',
    paid: 'unpaid',
    dueDate: '',
  })
  const setH = <K extends keyof HeaderForm>(k: K, v: HeaderForm[K]) =>
    setHdr((f) => ({ ...f, [k]: v }))

  const [lines, setLines] = useState<LineItem[]>([
    { invoiceNo: 'INV-', item: '', category: 'ค่าบริการ', qty: 1, unitPrice: 0, note: '' },
  ])

  const setLine = (i: number, k: keyof LineItem, v: string | number) =>
    setLines((arr) =>
      arr.map((l, idx) =>
        idx === i
          ? { ...l, [k]: k === 'qty' || k === 'unitPrice' ? +v || 0 : v }
          : l,
      ),
    )

  const addLine = () =>
    setLines((l) => [
      ...l,
      { invoiceNo: 'INV-', item: '', category: 'ค่าบริการ', qty: 1, unitPrice: 0, note: '' },
    ])

  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i))

  const totals = lines.map((l) => (l.qty || 0) * (l.unitPrice || 0))
  const netTotal = totals.reduce((s, t) => s + t, 0)

  const handleSave = () => {
    if (!hdr.vehicleId || !hdr.partnerId) {
      alert('กรุณาเลือกรถและช่าง/ผู้ขาย')
      return
    }
    const h = db.add<ExpenseHeader>('expenseHeaders', {
      ...hdr,
      id: '',
      paid: hdr.paid === 'paid',
      total: netTotal,
      lineCount: lines.length,
      odometer: Number(hdr.odometer) || 0,
      code: 'EXH-' + Date.now().toString().slice(-3),
      note: lines
        .map((l) => l.item)
        .filter(Boolean)
        .join(', '),
    })
    lines.forEach((l) =>
      db.add<ExpenseLine>('expenseLines', {
        ...l,
        id: '',
        headerId: h.id,
        amount: (l.qty || 0) * (l.unitPrice || 0),
      }),
    )
    alert('บันทึกเรียบร้อย')
    setHdr({ vehicleId: '', partnerId: '', date: '2026-05-16', odometer: '', paid: 'unpaid', dueDate: '' })
    setLines([{ invoiceNo: 'INV-', item: '', category: 'ค่าบริการ', qty: 1, unitPrice: 0, note: '' }])
  }

  const recent = db.getAll<ExpenseHeader>('expenseHeaders').slice(0, 3)

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
            <Field label="ช่าง / ผู้ขาย *">
              <select value={hdr.partnerId} onChange={(e) => setH('partnerId', e.target.value)}>
                <option value="">-- เลือกช่าง/ผู้ขาย --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
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
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="num muted">{i + 1}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      value={l.invoiceNo}
                      onChange={(e) => setLine(i, 'invoiceNo', e.target.value)}
                      style={{ ...inlineInput, maxWidth: 90 }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      value={l.item}
                      onChange={(e) => setLine(i, 'item', e.target.value)}
                      placeholder="ชื่อรายการ"
                      style={inlineInput}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <select
                      value={l.category}
                      onChange={(e) => setLine(i, 'category', e.target.value)}
                      style={{ ...inlineInput, maxWidth: 110 }}
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
              ))}
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

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginBottom: 18 }}>
        <button
          className="btn"
          onClick={() => {
            setHdr({ vehicleId: '', partnerId: '', date: '2026-05-16', odometer: '', paid: 'unpaid', dueDate: '' })
            setLines([{ invoiceNo: 'INV-', item: '', category: 'ค่าบริการ', qty: 1, unitPrice: 0, note: '' }])
          }}
        >
          <Icon name="close" size={14} /> รีเซ็ต
        </button>
        <button className="btn primary" onClick={handleSave}>
          บันทึก
        </button>
      </div>

      {/* Recent history */}
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
                <th>ช่าง/ผู้ขาย</th>
                <th className="right">จำนวนเงิน</th>
                <th>สถานะ</th>
                <th>รายการ</th>
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
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {h.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: สถานะการเงิน ──────────────────────────────────────────────────────

function ExpFinance() {
  const headers = db.getAll<ExpenseHeader>('expenseHeaders')
  const unpaidHeaders = headers.filter((h) => !h.paid)
  const today = new Date('2026-05-17')
  const overdue = unpaidHeaders.filter((h) => h.dueDate && new Date(h.dueDate) < today)
  const totalUnpaid = unpaidHeaders.reduce((s, h) => s + h.total, 0)
  const totalPaid = headers.filter((h) => h.paid).reduce((s, h) => s + h.total, 0)
  const [filter, setFilter] = useState('all')
  const [, forceUpdate] = useState(0)

  const list =
    filter === 'overdue'
      ? overdue
      : filter === 'due'
        ? unpaidHeaders.filter((h) => !overdue.includes(h))
        : unpaidHeaders

  const markPaid = (id: string) => {
    db.update<ExpenseHeader>('expenseHeaders', id, { paid: true })
    forceUpdate((n) => n + 1)
  }

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
                <th>ช่าง/ผู้ขาย</th>
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
                return (
                  <tr key={h.id}>
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      AP-{String(i + 1).padStart(3, '0')}
                    </td>
                    <td>{db.nameOf('partners', h.partnerId)}</td>
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
                        onClick={() => markPaid(h.id)}
                      >
                        บันทึกชำระ
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: สต๊อคคลัง KPS ────────────────────────────────────────────────────

function ExpStock() {
  const stock = db.getAll<StockItem>('stock')
  const [innerTab, setInnerTab] = useState('current')
  const total = stock.reduce((s, r) => s + r.qty * r.unitCost, 0)
  const low = stock.filter((s) => s.qty <= s.reorderAt)

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

      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <button className="btn primary">
          <Icon name="plus" size={14} /> รับสินค้าเข้าคลัง
        </button>
        <button className="btn">
          <Icon name="plus" size={14} /> เพิ่มรายการสินค้าใหม่
        </button>
      </div>

      <div className="card">
        <div className="head" style={{ padding: 0, borderBottom: '1px solid var(--line)' }}>
          <div className="tabs" style={{ margin: 0, border: 'none', padding: '0 20px' }}>
            <button
              className={`tab ${innerTab === 'current' ? 'active' : ''}`}
              onClick={() => setInnerTab('current')}
            >
              สรุปสต๊อคปัจจุบัน
            </button>
            <button
              className={`tab ${innerTab === 'history' ? 'active' : ''}`}
              onClick={() => setInnerTab('history')}
            >
              ประวัติการเคลื่อนไหว
            </button>
          </div>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อสินค้า</th>
                <th className="right">รับเข้า</th>
                <th className="right">จ่ายออก</th>
                <th className="right">คงเหลือ</th>
                <th className="right">ราคา/หน่วย</th>
                <th className="right">มูลค่าคงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id} style={s.qty <= s.reorderAt ? { background: 'var(--red-50)' } : undefined}>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {s.code}
                  </td>
                  <td>{s.name}</td>
                  <td className="num right" style={{ color: 'var(--green)' }}>
                    {s.in}
                  </td>
                  <td className="num right" style={{ color: 'var(--red)' }}>
                    {s.out}
                  </td>
                  <td
                    className="num right"
                    style={{ fontWeight: 600, color: s.qty <= s.reorderAt ? 'var(--red)' : undefined }}
                  >
                    {s.qty}
                  </td>
                  <td className="num right">{db.fmt(s.unitCost)} ฿</td>
                  <td className="num right" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {db.fmt(s.qty * s.unitCost)} ฿
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--green-50)', fontWeight: 700 }}>
                <td colSpan={6} className="right">
                  มูลค่าสต๊อครวม
                </td>
                <td className="num right" style={{ fontSize: 15, color: 'var(--primary)' }}>
                  {db.fmt(total)} ฿
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 4: รายงานสรุป ────────────────────────────────────────────────────────

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
    ['pivot', 'Pivot รถ × ผู้ขาย'],
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
                  <th>ช่าง/ผู้ขาย</th>
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
                  : 'Pivot รถ × ผู้ขาย'}{' '}
            — อยู่ในระหว่างเตรียมข้อมูล
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 5: ทะเบียนช่าง/ผู้ขาย ───────────────────────────────────────────────

function typeColor(t: string): string {
  if (t.includes('ช่าง')) return 'violet'
  if (t.includes('อะไหล่')) return 'amber'
  if (t.includes('คลัง')) return 'blue'
  return 'gray'
}

function ExpVendors() {
  const partners = db.getAll<Partner>('partners')
  const [q, setQ] = useState('')
  const filtered = partners.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="card">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="row">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ทะเบียนช่าง / ผู้ขาย</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              จัดการรายชื่อช่างและร้านค้าที่ใช้บริการ
            </div>
          </div>
          <div className="spacer" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา..."
            style={{
              height: 34,
              padding: '0 12px',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--bg)',
              fontSize: 13,
              width: 200,
            }}
          />
          <button className="btn primary">
            <Icon name="plus" size={14} /> เพิ่มใหม่
          </button>
        </div>
      </div>

      <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>ประเภท</th>
              <th>เบอร์โทร</th>
              <th>ธนาคาร / บัญชี</th>
              <th>เลขผู้เสียภาษี</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td>
                  <span className={`badge ${typeColor(p.type)}`}>{p.type}</span>
                </td>
                <td className="mono">{p.phone}</td>
                <td>{p.bank && p.bank !== '—' ? `${p.bank} / ${p.account}` : '—'}</td>
                <td className="mono muted">{p.taxId}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn ghost icon sm">
                      <Icon name="edit" size={13} />
                    </button>
                    <button className="btn ghost icon sm danger">
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
