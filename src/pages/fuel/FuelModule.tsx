import { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import { Icon } from '../../components/ui/Icon'
import { Field } from '../../components/ui/Field'
import type { FuelRecord, FuelStock, Vehicle, Employee } from '../../types'

// ── Tab 1: ภาพรวม ─── (Stock In editable + Stock Out history)

const inlineInput: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 10px',
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#fff',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

function FuelOverview() {
  const fuelStock = db.getAll<FuelStock>('fuelStock')
  const fuel = db.getAll<FuelRecord>('fuel')

  const totalStockL = fuelStock.reduce((s, r) => s + r.liters, 0)
  const totalStockBaht = fuelStock.reduce((s, r) => s + r.total, 0)
  const avgPrice = totalStockL > 0 ? totalStockBaht / totalStockL : 0
  const usedL = fuel.reduce((s, r) => s + r.liters, 0)
  const stockL = totalStockL - usedL

  // editable stock-in rows
  const [rows, setRows] = useState<FuelStock[]>(fuelStock)

  const updateRow = (i: number, k: string, v: string) => {
    setRows((rs) => {
      const arr = [...rs]
      const prev = arr[i]
      const updated: FuelStock = {
        ...prev,
        [k]:
          k === 'date' || k === 'supplier' || k === 'invoiceNo' ? v : +v || 0,
      }
      updated.total = (updated.liters || 0) * (updated.pricePerL || 0)
      arr[i] = updated
      return arr
    })
  }

  const addRow = () =>
    setRows((r) => [
      ...r,
      {
        id: 'fs' + Math.random().toString(36).slice(2, 8),
        date: new Date().toISOString().slice(0, 10),
        supplier: '',
        liters: 0,
        pricePerL: 0,
        invoiceNo: '',
        total: 0,
      },
    ])

  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))

  const netTotal = rows.reduce((s, r) => s + r.total, 0)
  const netLiters = rows.reduce((s, r) => s + r.liters, 0)

  const saveRows = () => {
    rows.forEach((r) => {
      const existing = db.get<FuelStock>('fuelStock', r.id)
      if (existing) db.update<FuelStock>('fuelStock', r.id, r)
      else db.add<FuelStock>('fuelStock', r)
    })
    alert('บันทึกเรียบร้อย')
  }

  const isExternal = (station: string) =>
    ['PTT', 'Shell', 'Bangchak', 'Esso'].some((s) => station.includes(s))

  return (
    <div>
      {/* KPI strip */}
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <div className="card kpi">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <div className="icn-box green">
              <Icon name="fuel" size={18} />
            </div>
            <div className="label">สต๊อคคงเหลือ</div>
          </div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
            {db.fmt(stockL)}{' '}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ลิตร</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            ราคาเฉลี่ย: {avgPrice.toFixed(2)} บาท/ลิตร
          </div>
        </div>
        <div className="card kpi">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <div className="icn-box">
              <Icon name="arrow-up" size={18} />
            </div>
            <div className="label">รับเข้าเดือนนี้</div>
          </div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
            0{' '}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ลิตร</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <div className="icn-box amber">
              <Icon name="arrow-down" size={18} />
            </div>
            <div className="label">จ่ายออกเดือนนี้ (จากถัง)</div>
          </div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
            0{' '}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>ลิตร</span>
          </div>
        </div>
      </div>

      {/* Stock In editable table */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h3>บันทึกน้ำมันเข้า (Stock In)</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              แก้ไขข้อมูลได้โดยตรงในตาราง • สต๊อคคงเหลือ = รับเข้า - จ่ายออก (จากถังโรงงาน)
            </div>
          </div>
          <div className="right">
            <button className="btn outline sm" onClick={addRow}>
              <Icon name="plus" size={13} /> เพิ่มแถว
            </button>
            <button className="btn primary sm" onClick={saveRows}>
              บันทึก
            </button>
          </div>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ผู้จำหน่าย *</th>
                <th className="right">จำนวนลิตร *</th>
                <th className="right">ราคา/ลิตร (บาท)</th>
                <th>เลขใบส่งของ</th>
                <th className="right">จำนวนเงิน</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => updateRow(i, 'date', e.target.value)}
                      style={inlineInput}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      value={r.supplier}
                      onChange={(e) => updateRow(i, 'supplier', e.target.value)}
                      style={inlineInput}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="number"
                      value={r.liters}
                      onChange={(e) => updateRow(i, 'liters', e.target.value)}
                      style={{ ...inlineInput, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="number"
                      value={r.pricePerL}
                      onChange={(e) => updateRow(i, 'pricePerL', e.target.value)}
                      style={{ ...inlineInput, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      value={r.invoiceNo}
                      onChange={(e) => updateRow(i, 'invoiceNo', e.target.value)}
                      style={inlineInput}
                    />
                  </td>
                  <td className="num right" style={{ padding: '8px 10px', fontWeight: 600 }}>
                    {r.total.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td style={{ padding: '8px 4px' }}>
                    <button
                      className="btn ghost icon sm danger"
                      onClick={() => removeRow(i)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--green-50)' }}>
                <td
                  colSpan={5}
                  className="right"
                  style={{ padding: '12px 16px', fontWeight: 700 }}
                >
                  ผลรวมสุทธิ (Net Total):
                </td>
                <td
                  className="num right mono"
                  style={{ padding: '12px 16px', fontWeight: 700, fontSize: 16, color: '#166534' }}
                >
                  {netTotal.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  บาท
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div
          className="row"
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--line)',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <span>{rows.length} รายการ</span>
          <div className="spacer" />
          <span>รวม {db.fmt(netLiters)} ลิตร</span>
        </div>
      </div>

      {/* Stock Out history */}
      <div className="card">
        <div className="head" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3>ประวัติการจ่ายน้ำมัน (Stock Out จากการเติมรถ)</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              เฉพาะจากถังโรงงาน — ปั๊มภายนอกไม่นับเป็นการตัดสต๊อค
            </div>
          </div>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ทะเบียนรถ</th>
                <th>คนขับ</th>
                <th className="right">ลิตร</th>
                <th className="right">จำนวนเงิน</th>
                <th>แหล่งน้ำมัน</th>
              </tr>
            </thead>
            <tbody>
              {fuel.map((f) => (
                <tr key={f.id}>
                  <td className="num muted">{db.thaiDate(f.date.slice(0, 10))}</td>
                  <td>
                    <a style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">
                      {db.nameOf('vehicles', f.vehicleId)}
                    </a>
                  </td>
                  <td>{db.nameOf('employees', f.driverId)}</td>
                  <td className="num right">{f.liters}</td>
                  <td className="num right" style={{ fontWeight: 600 }}>
                    {db.fmt(f.total)} บาท
                  </td>
                  <td>
                    {isExternal(f.station) ? (
                      <span className="badge amber">ปั๊มภายนอก</span>
                    ) : (
                      <span className="badge blue">ถังโรงงาน</span>
                    )}
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

// ─── Tab 2: บันทึก ─── (Fuel record form)
function FuelRecord() {
  const [form, setForm] = useState({
    vehicleId: '',
    driverId: '',
    odometer: '',
    liters: '',
    pricePerL: 35,
    source: 'tank',
    note: '',
  })
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))
  const total = (+form.liters || 0) * (+form.pricePerL || 0)
  const fuel = db.getAll<FuelRecord>('fuel')

  const save = () => {
    if (!form.vehicleId || !form.driverId || !form.liters) {
      alert('กรุณาเลือกรถ คนขับ และระบุปริมาณ')
      return
    }
    db.add<FuelRecord>('fuel', {
      id: uid('f'),
      code:
        'FUL-' +
        new Date().toISOString().slice(2, 10).replace(/-/g, '') +
        Math.floor(Math.random() * 100),
      vehicleId: form.vehicleId,
      driverId: form.driverId,
      station: form.source === 'tank' ? 'ถังโรงงาน' : 'ปั๊มภายนอก',
      liters: +form.liters,
      pricePerL: +form.pricePerL,
      total,
      odometer: +form.odometer || 0,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      type: 'diesel',
    })
    alert('บันทึกการเติมน้ำมันเรียบร้อย')
    setForm({ vehicleId: '', driverId: '', odometer: '', liters: '', pricePerL: 35, source: 'tank', note: '' })
  }

  const isExternal = (station: string) =>
    ['PTT', 'Shell', 'Bangchak', 'Esso'].some((s) => station.includes(s))

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head">
          <h3>บันทึกการเติมน้ำมันรถ</h3>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลือกรถ *">
              <select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
                <option value="">-- เลือกรถ --</option>
                {db.getAll<Vehicle>('vehicles').map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} • {v.brand}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="คนขับ">
              <select value={form.driverId} onChange={(e) => set('driverId', e.target.value)}>
                <option value="">-- เลือกคนขับ --</option>
                {db
                  .getAll<Employee>('employees')
                  .filter((e) => e.position === 'คนขับ')
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="เลขไมล์">
              <input
                type="number"
                value={form.odometer}
                onChange={(e) => set('odometer', e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ปริมาณ (ลิตร) *">
              <input
                type="number"
                value={form.liters}
                onChange={(e) => set('liters', e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="ราคา/ลิตร (บาท)">
              <input
                type="number"
                value={form.pricePerL}
                onChange={(e) => set('pricePerL', e.target.value)}
              />
            </Field>
          </div>
          <Field label="แหล่งน้ำมัน">
            <div className="row" style={{ gap: 18, paddingTop: 4 }}>
              <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                <input
                  type="radio"
                  name="source"
                  checked={form.source === 'tank'}
                  onChange={() => set('source', 'tank')}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>ถังโรงงาน (ตัดสต๊อค)</span>
              </label>
              <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                <input
                  type="radio"
                  name="source"
                  checked={form.source === 'external'}
                  onChange={() => set('source', 'external')}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>ปั๊มภายนอก</span>
              </label>
            </div>
            <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
              * จะตัดสต๊อคคลังน้ำมัน
            </div>
          </Field>

          <div
            style={{
              marginTop: 14,
              padding: '12px 16px',
              background: 'var(--primary-50)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>รวมเป็นเงิน:</span>
            <div className="spacer" />
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
              {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              บาท
            </span>
          </div>

          <Field label="หมายเหตุ" full>
            <textarea
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              rows={2}
              style={{ marginTop: 12 }}
            />
          </Field>

          <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end', gap: 8 }}>
            <button
              className="btn"
              onClick={() =>
                setForm({
                  vehicleId: '',
                  driverId: '',
                  odometer: '',
                  liters: '',
                  pricePerL: 35,
                  source: 'tank',
                  note: '',
                })
              }
            >
              รีเซ็ต
            </button>
            <button className="btn primary" onClick={save}>
              บันทึก
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="head">
          <h3>ประวัติการเติมน้ำมัน</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ทะเบียนรถ</th>
                <th className="right">ปริมาณ (ลิตร)</th>
                <th className="right">จำนวนเงิน</th>
                <th>คนขับ</th>
                <th>แหล่งน้ำมัน</th>
              </tr>
            </thead>
            <tbody>
              {fuel.map((f) => (
                <tr key={f.id}>
                  <td className="num muted">{db.thaiDate(f.date.slice(0, 10))}</td>
                  <td>
                    <a style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">
                      {db.nameOf('vehicles', f.vehicleId)}
                    </a>
                  </td>
                  <td className="num right">{f.liters}</td>
                  <td className="num right" style={{ fontWeight: 600 }}>
                    {db.fmt(f.total)} บาท
                  </td>
                  <td>{db.nameOf('employees', f.driverId)}</td>
                  <td>
                    {isExternal(f.station) ? (
                      <span className="badge amber">ปั๊มภายนอก</span>
                    ) : (
                      <span className="badge blue">ถังโรงงาน</span>
                    )}
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

// ─── Tab 3: รายงาน ─── (Vehicle picker + daily table)
function FuelReportV2() {
  const vehicles = db.getAll<Vehicle>('vehicles')
  const [month, setMonth] = useState(5)
  const [year, setYear] = useState(2025)
  const [picked, setPicked] = useState<Record<string, boolean>>(
    vehicles.reduce<Record<string, boolean>>((acc, v) => ({ ...acc, [v.id]: true }), {}),
  )
  const [searchPlate, setSearchPlate] = useState('')

  const pickedIds = useMemo(() => Object.keys(picked).filter((k) => picked[k]), [picked])

  // Demo pivot data — in production this would be derived from fuel records filtered by month/year
  const days = [1, 2, 3, 4]
  const data: Record<string, Record<number, number | null> & { total: number }> = {
    v1: { 1: 25, 2: 20, 3: null, 4: null, total: 150 },
    v2: { 1: 30, 2: null, 3: 28, 4: null, total: 120 },
    v3: { 1: 15, 2: 25, 3: null, 4: null, total: 95 },
  }

  const dayTotals = days.map((d) =>
    pickedIds.reduce((s, vid) => s + (data[vid]?.[d] ?? 0), 0),
  )
  const grand = pickedIds.reduce((s, vid) => s + (data[vid]?.total ?? 0), 0)

  const monthNames = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
  ]

  return (
    <div>
      {/* Filter strip */}
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
          <Field label="เดือน">
            <select
              value={month}
              onChange={(e) => setMonth(+e.target.value)}
              style={{ width: 160 }}
            >
              {monthNames.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m} ({String(i + 1).padStart(2, '0')})
                </option>
              ))}
            </select>
          </Field>
          <Field label="ปี">
            <select
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              style={{ width: 120 }}
            >
              {[2567, 2568, 2569, 2570].map((y) => (
                <option key={y} value={y - 543}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
          <div className="spacer" />
          <button className="btn">รีเซ็ต</button>
          <button className="btn primary">ค้นหา</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* Left: vehicle picker */}
        <div className="card">
          <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
            <div className="row">
              <span style={{ fontWeight: 600 }}>เลือกรถ</span>
              <div className="spacer" />
              <span className="badge blue">
                {pickedIds.length}/{vehicles.length} คัน
              </span>
            </div>
            <div style={{ position: 'relative', marginTop: 10 }}>
              <Icon
                name="search"
                size={13}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-faint)',
                }}
              />
              <input
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                placeholder="ค้นหาทะเบียน..."
                style={{
                  width: '100%',
                  height: 32,
                  padding: '0 12px 0 30px',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  background: 'var(--bg)',
                  fontSize: 12.5,
                }}
              />
            </div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <label
              className="row"
              style={{ gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={vehicles.every((v) => picked[v.id])}
                onChange={(e) =>
                  setPicked(
                    vehicles.reduce<Record<string, boolean>>(
                      (acc, v) => ({ ...acc, [v.id]: e.target.checked }),
                      {},
                    ),
                  )
                }
                style={{ accentColor: 'var(--primary)' }}
              />
              <span style={{ fontWeight: 600 }}>เลือกทั้งหมด</span>
            </label>
            {vehicles
              .filter((v) => !searchPlate || v.plate.includes(searchPlate))
              .map((v) => (
                <label
                  key={v.id}
                  className="row"
                  style={{
                    gap: 8,
                    padding: '8px 0',
                    cursor: 'pointer',
                    fontSize: 13,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!picked[v.id]}
                    onChange={() => setPicked((p) => ({ ...p, [v.id]: !p[v.id] }))}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="mono" style={{ fontWeight: 500, flex: 1 }}>
                    {v.plate}
                  </span>
                  <span className="muted mono" style={{ fontSize: 11 }}>
                    {data[v.id]?.total ?? 0} ล.
                  </span>
                </label>
              ))}
          </div>
          <div className="row" style={{ padding: 14, borderTop: '1px solid var(--line)', gap: 8 }}>
            <button
              className="btn sm outline"
              style={{ flex: 1 }}
              onClick={() =>
                setPicked(
                  vehicles.reduce<Record<string, boolean>>(
                    (acc, v) => ({ ...acc, [v.id]: true }),
                    {},
                  ),
                )
              }
            >
              เลือกทั้งหมด
            </button>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => setPicked({})}>
              ล้างทั้งหมด
            </button>
          </div>
        </div>

        {/* Right: daily table */}
        <div className="card">
          <div className="head">
            <div>
              <h3>รายงานการใช้น้ำมันรายวัน</h3>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                แสดงผลรถทั้งหมด {pickedIds.length} คัน (เฉพาะที่มีการใช้งาน)
              </div>
            </div>
            <div className="right">
              <button className="btn sm">Excel</button>
              <button className="btn sm primary">พิมพ์ (A4)</button>
            </div>
          </div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่ \ ทะเบียน</th>
                  {pickedIds.map((vid) => (
                    <th key={vid} className="right mono">
                      {db.nameOf('vehicles', vid)}
                    </th>
                  ))}
                  <th className="right">รวมรายวัน</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d}>
                    <td>
                      {d} {monthNames[month - 1]?.slice(0, 3)} {year - 543 + 543}
                    </td>
                    {pickedIds.map((vid) => {
                      const val = data[vid]?.[d]
                      return (
                        <td key={vid} className="num right">
                          {val ?? '-'}
                        </td>
                      )
                    })}
                    <td className="num right" style={{ fontWeight: 600 }}>
                      {dayTotals[i] || '-'}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-sunk)', fontWeight: 700 }}>
                  <td>รวมทั้งหมด</td>
                  {pickedIds.map((vid) => (
                    <td key={vid} className="num right">
                      {data[vid]?.total ?? 0}
                    </td>
                  ))}
                  <td
                    className="num right"
                    style={{ color: 'var(--green)', background: 'var(--green-50)' }}
                  >
                    {grand}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Module Router ─────────────────────────────────────────────────
export function FuelModule({ tab, setActive }: { tab: string; setActive: (id: string) => void }) {
  const current = tab === 'logs' ? 'record' : tab === 'report' ? 'report' : 'overview'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ระบบน้ำมัน</h1>
        </div>
        <div className="actions">
          <button className="btn">
            <Icon name="plus" size={14} /> บันทึกน้ำมันเข้า
          </button>
          <button className="btn primary">
            <Icon name="plus" size={14} /> เติมน้ำมันรถ
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 22 }}>
        {(
          [
            ['overview', 'fuel', 'ภาพรวม', 'fuel'],
            ['record', 'logs', 'บันทึก', 'edit'],
            ['report', 'report', 'รายงาน', 'chart'],
          ] as [string, string, string, string][]
        ).map(([id, route, label, ic]) => (
          <button
            key={id}
            className={`tab ${current === id ? 'active' : ''}`}
            onClick={() => setActive('fuel' + (route === 'fuel' ? '' : '.' + route))}
          >
            <Icon name={ic} size={14} style={{ marginRight: 6, verticalAlign: -3 }} />
            {label}
          </button>
        ))}
      </div>

      {current === 'overview' && <FuelOverview />}
      {current === 'record' && <FuelRecord />}
      {current === 'report' && <FuelReportV2 />}
    </div>
  )
}
