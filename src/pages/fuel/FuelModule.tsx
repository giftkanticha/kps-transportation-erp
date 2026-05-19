import React, { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import { Icon } from '../../components/ui/Icon'
import { Field } from '../../components/ui/Field'
import type { CSSProperties } from 'react'
import type { FuelRecord, FuelStock, Vehicle, Employee } from '../../types'
import { FuelInventorySummary } from './FuelInventorySummary'
import { ExpressFuelLog } from './ExpressFuelLog'
import { FloatingFuel } from './FloatingFuel'
import { FuelReconciliation } from './FuelReconciliation'

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

const tabBtn = (active: boolean): CSSProperties => ({
  padding: '6px 16px',
  borderRadius: 7,
  border: 'none',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-2)',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  fontSize: 13.5,
  transition: 'all .15s',
})

const isFactoryFuel = (f: FuelRecord) =>
  !['PTT', 'Shell', 'Bangchak', 'Esso'].some(s => f.station?.includes(s))

type FuelVal = { liters: number; amount: number }

// ── Tab 1: ภาพรวม ─── (Stock In editable + Stock Out history)

const inlineInput: CSSProperties = {
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

// ─── Tab 3: รายงาน ─── (Per-vehicle fuel report with source, time & metric toggles)
function FuelReportV2() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [source, setSource] = useState<'tank' | 'external'>('tank')
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')
  const [metric, setMetric] = useState<'liters' | 'amount'>('liters')

  const allFuelings = useMemo(() => db.getAll<FuelRecord>('fuel'), [])
  const vehicles = useMemo(() => db.getAll<Vehicle>('vehicles'), [])

  const filteredFuel = useMemo(
    () => allFuelings.filter(f => source === 'tank' ? isFactoryFuel(f) : !isFactoryFuel(f)),
    [allFuelings, source],
  )

  const days = daysInMonth(year, month)

  const monthlyMatrix = useMemo<Record<number, Record<string, FuelVal>>>(() => {
    const data: Record<number, Record<string, FuelVal>> = {}
    for (let d = 1; d <= days; d++) data[d] = {}
    filteredFuel.forEach(f => {
      const dt = new Date(f.date)
      if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return
      const d = dt.getDate()
      if (!data[d][f.vehicleId]) data[d][f.vehicleId] = { liters: 0, amount: 0 }
      data[d][f.vehicleId].liters += f.liters || 0
      data[d][f.vehicleId].amount += f.total || 0
    })
    return data
  }, [filteredFuel, year, month, days])

  const yearlyMatrix = useMemo<Record<string, Record<number, FuelVal>>>(() => {
    const data: Record<string, Record<number, FuelVal>> = {}
    filteredFuel.forEach(f => {
      const dt = new Date(f.date)
      if (dt.getFullYear() !== year) return
      const m = dt.getMonth() + 1
      if (!data[f.vehicleId]) data[f.vehicleId] = {}
      if (!data[f.vehicleId][m]) data[f.vehicleId][m] = { liters: 0, amount: 0 }
      data[f.vehicleId][m].liters += f.liters || 0
      data[f.vehicleId][m].amount += f.total || 0
    })
    return data
  }, [filteredFuel, year])

  const activeVehicles = useMemo(() => {
    const usedIds = new Set<string>()
    if (viewMode === 'monthly') {
      for (let d = 1; d <= days; d++) {
        Object.keys(monthlyMatrix[d] || {}).forEach(id => usedIds.add(id))
      }
    } else {
      Object.keys(yearlyMatrix).forEach(id => usedIds.add(id))
    }
    return vehicles.filter(v => usedIds.has(v.id) || v.status === 'available' || v.status === 'on-trip')
  }, [vehicles, monthlyMatrix, yearlyMatrix, viewMode, days])

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const getVal = (v: FuelVal | undefined) => metric === 'liters' ? (v?.liters || 0) : (v?.amount || 0)
  const unitLabel = metric === 'liters' ? 'ลิตร' : 'บาท'
  const unitBadge = (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: metric === 'liters' ? '#EFF6FF' : '#FFF7ED',
      color: metric === 'liters' ? '#1D4ED8' : '#C2410C',
    }}>
      {unitLabel}
    </span>
  )

  const dailyTotal = (d: number) => activeVehicles.reduce((sum, v) => sum + getVal(monthlyMatrix[d]?.[v.id]), 0)
  const vehicleMonthlyTotal = (vid: string) => {
    let t = 0
    for (let d = 1; d <= days; d++) t += getVal(monthlyMatrix[d]?.[vid])
    return t
  }
  const vehicleYearlyTotal = (vid: string) => {
    let t = 0
    for (let m = 1; m <= 12; m++) t += getVal(yearlyMatrix[vid]?.[m])
    return t
  }
  const monthColTotal = (m: number) => activeVehicles.reduce((sum, v) => sum + getVal(yearlyMatrix[v.id]?.[m]), 0)
  const grandTotalMonthly = activeVehicles.reduce((sum, v) => sum + vehicleMonthlyTotal(v.id), 0)
  const grandTotalYearly = activeVehicles.reduce((sum, v) => sum + vehicleYearlyTotal(v.id), 0)

  const sourceLabel = source === 'tank' ? 'ถังโรงงาน' : 'ปั๊มนอก'
  const periodLabel = viewMode === 'monthly'
    ? `${THAI_MONTHS_FULL[month - 1]} พ.ศ. ${year + 543}`
    : `ปี พ.ศ. ${year + 543}`

  const pillGroup = (label: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, paddingLeft: 2 }}>{label}</div>
      <div style={{ display: 'flex', gap: 0, padding: 3, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
        {children}
      </div>
    </div>
  )

  const tblWrap: CSSProperties = {
    borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', background: '#fff', marginBottom: 18,
  }

  return (
    <div>
      {/* Controls */}
      <div className="card pad no-print" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {viewMode === 'monthly' && (
            <Field label="เดือน">
              <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 150 }}>
                {THAI_MONTHS_FULL.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="ปี (พ.ศ.)">
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 120 }}>
              {Array.from({ length: 11 }, (_, i) => 2025 + i).map(y => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </Field>
          <div style={{ flex: 1 }} />
          {pillGroup('แสดงผลเป็น',
            <>
              <button style={tabBtn(metric === 'liters')} onClick={() => setMetric('liters')}>จำนวนลิตร</button>
              <button style={tabBtn(metric === 'amount')} onClick={() => setMetric('amount')}>จำนวนเงิน</button>
            </>,
          )}
          {pillGroup('แหล่งน้ำมัน',
            <>
              <button style={tabBtn(source === 'tank')} onClick={() => setSource('tank')}>ถังโรงงาน</button>
              <button style={tabBtn(source === 'external')} onClick={() => setSource('external')}>ปั๊มนอก</button>
            </>,
          )}
          {pillGroup('ช่วงเวลา',
            <>
              <button style={tabBtn(viewMode === 'monthly')} onClick={() => setViewMode('monthly')}>รายเดือน</button>
              <button style={tabBtn(viewMode === 'yearly')} onClick={() => setViewMode('yearly')}>ภาพรวมรายปี</button>
            </>,
          )}
          <button className="btn primary" onClick={() => window.print()} style={{ height: 36 }}>
            <Icon name="download" size={15} /> พิมพ์
          </button>
        </div>
      </div>

      {/* Print header */}
      <div
        className="print-only"
        style={{ textAlign: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #000' }}
      >
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>KPS Transportations</h1>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>
          รายงานการใช้น้ำมัน{viewMode === 'yearly' ? 'ภาพรวมรายปี' : 'รายเดือน'} — {sourceLabel} ({metric === 'liters' ? 'จำนวนลิตร' : 'จำนวนเงิน'})
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{periodLabel}</div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</div>
      </div>

      {/* Monthly: per-vehicle daily matrix */}
      {viewMode === 'monthly' && (
        <div style={tblWrap}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #E2E8F0', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                การใช้น้ำมันรายวันต่อคัน — {THAI_MONTHS_FULL[month - 1]} {year + 543} ({sourceLabel})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{activeVehicles.length} คัน · {days} วัน</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>{unitBadge}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {activeVehicles.length === 0 ? (
              <div className="empty" style={{ padding: 40 }}>ไม่มีข้อมูลการใช้น้ำมัน</div>
            ) : (
              <table className="tbl" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-sunk)', minWidth: 90 }}>วันที่</th>
                    {activeVehicles.map(v => (
                      <th key={v.id} className="right mono" style={{ whiteSpace: 'nowrap' }}>{v.plate}</th>
                    ))}
                    <th className="right" style={{ background: '#FFF8E1', color: '#7A5A00', whiteSpace: 'nowrap' }}>
                      รวมรายวัน ({unitLabel})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: days }, (_, i) => i + 1).map(d => {
                    const tot = dailyTotal(d)
                    return (
                      <tr key={d}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card)', fontWeight: 500 }}>
                          {d} {THAI_MONTHS_SHORT[month - 1]}
                        </td>
                        {activeVehicles.map(v => {
                          const val = getVal(monthlyMatrix[d]?.[v.id])
                          return (
                            <td key={v.id} className="num right mono" style={{ color: val > 0 ? 'var(--text-1)' : 'var(--text-faint)' }}>
                              {val > 0 ? fmt(val) : '—'}
                            </td>
                          )
                        })}
                        <td className="num right mono" style={{ background: '#FFF8E1', fontWeight: 700, color: '#7A5A00' }}>
                          {tot > 0 ? fmt(tot) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: 'var(--primary-50)', fontWeight: 700 }}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--primary-50)', color: 'var(--primary)' }}>
                      รวมต่อคัน ({unitLabel})
                    </td>
                    {activeVehicles.map(v => (
                      <td key={v.id} className="num right mono" style={{ color: 'var(--primary)' }}>
                        {fmt(vehicleMonthlyTotal(v.id))}
                      </td>
                    ))}
                    <td className="num right mono" style={{ background: '#FFE08A', color: '#5A3D00', fontWeight: 800 }}>
                      {fmt(grandTotalMonthly)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Yearly: per-vehicle 12-month summary */}
      {viewMode === 'yearly' && (
        <div style={tblWrap}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #E2E8F0', gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              ภาพรวมการใช้น้ำมันรายปี พ.ศ. {year + 543} ({sourceLabel})
            </div>
            <div style={{ marginLeft: 'auto' }}>{unitBadge}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {activeVehicles.length === 0 ? (
              <div className="empty" style={{ padding: 40 }}>ไม่มีข้อมูลการใช้น้ำมัน</div>
            ) : (
              <table className="tbl" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-sunk)', minWidth: 100 }}>ทะเบียนรถ</th>
                    {THAI_MONTHS_SHORT.map((m, i) => (
                      <th key={i} className="right" style={{ whiteSpace: 'nowrap' }}>{m}</th>
                    ))}
                    <th className="right" style={{ background: '#FFF8E1', color: '#7A5A00', whiteSpace: 'nowrap' }}>
                      รวมทั้งปี ({unitLabel})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeVehicles.map(v => (
                    <tr key={v.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card)', fontWeight: 600 }} className="mono">
                        {v.plate}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const val = getVal(yearlyMatrix[v.id]?.[m])
                        return (
                          <td key={m} className="num right mono" style={{ color: val > 0 ? 'var(--text-1)' : 'var(--text-faint)' }}>
                            {val > 0 ? fmt(val) : '—'}
                          </td>
                        )
                      })}
                      <td className="num right mono" style={{ background: '#FFF8E1', fontWeight: 700, color: '#7A5A00' }}>
                        {fmt(vehicleYearlyTotal(v.id))}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--primary-50)', fontWeight: 700 }}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--primary-50)', color: 'var(--primary)' }}>
                      รวมทุกคัน ({unitLabel})
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const tot = monthColTotal(m)
                      return (
                        <td key={m} className="num right mono" style={{ color: 'var(--primary)' }}>
                          {tot > 0 ? fmt(tot) : '—'}
                        </td>
                      )
                    })}
                    <td className="num right mono" style={{ background: '#FFE08A', color: '#5A3D00', fontWeight: 800 }}>
                      {fmt(grandTotalYearly)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Signature block (print only) */}
      <div
        className="print-only"
        style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, pageBreakInside: 'avoid', breakInside: 'avoid' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>ผู้จัดทำ</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>(.....................................)  </div>
          <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: 6, marginTop: 50, fontSize: 13 }}>ผู้อนุมัติ</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>(.....................................)  </div>
          <div style={{ fontSize: 11, color: '#666' }}>วันที่ ......./......./.......</div>
        </div>
      </div>
    </div>
  )
}

// ── Module Router ─────────────────────────────────────────────────
export function FuelModule({ tab, setActive }: { tab: string; setActive: (id: string) => void }) {
  const current =
    tab === 'report' ? 'report' :
    tab === 'summary' ? 'summary' :
    tab === 'express' ? 'express' :
    tab === 'floating' ? 'floating' :
    tab === 'reconcile' ? 'reconcile' :
    'overview'

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">ระบบน้ำมัน</h1>
        </div>
      </div>

      <div className="tabs no-print" style={{ marginBottom: 22 }}>
        {(
          [
            ['overview', 'fuel', '📦 คลังน้ำมัน', 'fuel'],
            ['express', 'express', '⚡ คีย์ด่วน', 'edit'],
            ['floating', 'floating', '🟡 น้ำมันลอย', 'alert'],
            ['report', 'report', '📋 รายงาน', 'chart'],
            ['summary', 'summary', '📝 บันทึกเข้า-ออก', 'download'],
            ['reconcile', 'reconcile', '🔍 ตรวจสอบข้อมูล', 'search'],
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

      {current === 'overview' && <FuelInventorySummary />}
      {current === 'express' && <ExpressFuelLog setActive={setActive} />}
      {current === 'floating' && <FloatingFuel />}
      {current === 'report' && <FuelReportV2 />}
      {current === 'summary' && <FuelOverview />}
      {current === 'reconcile' && <FuelReconciliation />}
    </div>
  )
}
