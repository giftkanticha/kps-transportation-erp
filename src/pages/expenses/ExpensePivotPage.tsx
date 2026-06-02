import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { Icon, Field, VehiclePickerSidebar } from '../../components/ui'
import { usePrint } from '../../hooks/usePrint'
import type { ExpenseHeader, Partner, Vehicle } from '../../types'

export function ExpensePivotPage() {
  const { print } = usePrint()
  const { data: allVehicles = [] } = useList<Vehicle>('vehicles')
  const { data: partners = [] } = useList<Partner>('partners')
  const { data: headers = [] } = useList<ExpenseHeader>('expense_headers')

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pickedVehicles, setPickedVehicles] = useState<Set<string>>(
    () => new Set(allVehicles.map(v => v.id)),
  )
  const vehicles = useMemo(
    () => allVehicles.filter(v => pickedVehicles.has(v.id)),
    [allVehicles, pickedVehicles],
  )

  // Filter headers by date range
  const filteredHeaders = useMemo(
    () =>
      headers.filter((h) => {
        if (dateFrom && h.date < dateFrom) return false
        if (dateTo && h.date > dateTo) return false
        return true
      }),
    [headers, dateFrom, dateTo],
  )

  // Only show vendors that have at least one transaction in the filtered range
  const activeVendorIds = useMemo(() => {
    const ids = new Set<string>()
    filteredHeaders.forEach((h) => ids.add(h.partnerId))
    return ids
  }, [filteredHeaders])

  const activeVendors = useMemo(
    () => partners.filter((p) => activeVendorIds.has(p.id)),
    [partners, activeVendorIds],
  )

  // Pivot: matrix[vehicleId][partnerId] = total
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    vehicles.forEach((v) => {
      m[v.id] = {}
      activeVendors.forEach((p) => (m[v.id][p.id] = 0))
    })
    filteredHeaders.forEach((h) => {
      if (!m[h.vehicleId]) return
      m[h.vehicleId][h.partnerId] = (m[h.vehicleId][h.partnerId] || 0) + h.total
    })
    return m
  }, [vehicles, activeVendors, filteredHeaders])

  // Totals per row (vehicle) and per column (vendor)
  const rowTotal = (vid: string): number =>
    activeVendors.reduce((sum, p) => sum + (matrix[vid]?.[p.id] || 0), 0)
  const colTotal = (pid: string): number =>
    vehicles.reduce((sum, v) => sum + (matrix[v.id]?.[pid] || 0), 0)
  const grandTotal = vehicles.reduce((sum, v) => sum + rowTotal(v.id), 0)

  const fmt = (n: number) => (n > 0 ? db.fmt(n) : '—')

  const dateRangeLabel = () => {
    if (!dateFrom && !dateTo) return 'ทุกช่วงเวลา'
    const from = dateFrom ? db.thaiDate(dateFrom) : 'เริ่มต้น'
    const to = dateTo ? db.thaiDate(dateTo) : 'ปัจจุบัน'
    return `${from} ถึง ${to}`
  }

  const handlePrint = () => {
    print('landscape')
  }

  return (
    <div>
      {/* Print-only header (hidden on screen) */}
      <div className="print-only" style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>KPS Transportation ERP</h1>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
          รายงานสรุปค่าใช้จ่ายรวมรายคัน × คู่ค้า
        </div>
        <div style={{ fontSize: 11.5, color: '#555', marginTop: 4 }}>
          ช่วงข้อมูล: <strong>{dateRangeLabel()}</strong> · พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}
        </div>
        <div style={{ borderBottom: '1px solid #999', marginTop: 8 }} />
      </div>

      {/* Regular page head (hidden on print) */}
      <div className="page-head">
        <div>
          <h1 className="page-title">สรุปค่าใช้จ่ายรวม รายคัน × คู่ค้า</h1>
          <div className="page-sub">
            ตาราง Pivot รวมยอดค่าใช้จ่ายแยกตามทะเบียนรถและคู่ค้า — รวม {filteredHeaders.length} รายการ
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={handlePrint}>
            <Icon name="download" size={15} /> พิมพ์รายงาน (PDF)
          </button>
        </div>
      </div>

      {/* Filters — hidden on print */}
      <div className="card pad no-print" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="จากวันที่">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: 180 }}
            />
          </Field>
          <Field label="ถึงวันที่">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: 180 }}
            />
          </Field>
          <div className="row" style={{ gap: 6, marginLeft: 4 }}>
            <button
              className="btn sm"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
            >
              <Icon name="close" size={13} /> ล้างตัวกรอง
            </button>
            <button
              className="btn sm"
              onClick={() => {
                const today = new Date()
                const m1 = new Date(today.getFullYear(), today.getMonth(), 1)
                setDateFrom(m1.toISOString().slice(0, 10))
                setDateTo(today.toISOString().slice(0, 10))
              }}
            >
              เดือนนี้
            </button>
            <button
              className="btn sm"
              onClick={() => {
                const today = new Date()
                const m1 = new Date(today.getFullYear(), today.getMonth() - 2, 1)
                setDateFrom(m1.toISOString().slice(0, 10))
                setDateTo(today.toISOString().slice(0, 10))
              }}
            >
              3 เดือน
            </button>
          </div>
          <div className="spacer" />
          <div
            className="row"
            style={{ gap: 16, fontSize: 12.5, color: 'var(--text-2)' }}
          >
            <span>
              เลือกแล้ว: <strong>{vehicles.length}/{allVehicles.length} คัน</strong>
            </span>
            <span>
              คู่ค้าที่มียอด: <strong>{activeVendors.length} ราย</strong>
            </span>
            <span>
              ยอดรวมทั้งสิ้น:{' '}
              <strong style={{ color: 'var(--primary)' }}>{db.thb(grandTotal)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar + Print area */}
      <div className="pivot-print-wrap no-print" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <VehiclePickerSidebar
          vehicles={allVehicles}
          picked={pickedVehicles}
          onChange={setPickedVehicles}
        />

        <div style={{ flex: 1, minWidth: 0 }} className="print-area">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="head">
            <h3>ตารางสรุป — ค่าใช้จ่ายรวม ({dateRangeLabel()})</h3>
          </div>
          <div style={{ overflowX: 'auto' }} className="pivot-scroll">
            <table className="tbl pivot-print" style={{ minWidth: '100%' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: 'var(--bg-sunk)',
                      zIndex: 2,
                      minWidth: 160,
                      borderRight: '2px solid var(--line)',
                    }}
                  >
                    ทะเบียน \ คู่ค้า
                  </th>
                  {activeVendors.map((p) => (
                    <th key={p.id} className="right" style={{ minWidth: 130 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div
                        className="muted"
                        style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}
                      >
                        {p.type}
                      </div>
                    </th>
                  ))}
                  <th
                    className="right"
                    style={{
                      background: 'var(--primary-50)',
                      minWidth: 140,
                      borderLeft: '2px solid var(--primary)',
                      color: 'var(--primary)',
                    }}
                  >
                    รวมจ่ายต่อคัน
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const rt = rowTotal(v.id)
                  return (
                    <tr key={v.id}>
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          background: '#fff',
                          zIndex: 1,
                          borderRight: '2px solid var(--line)',
                          fontWeight: 600,
                        }}
                      >
                        <span className="mono" style={{ color: 'var(--primary)' }}>
                          {v.plate}
                        </span>
                        <div
                          className="muted"
                          style={{ fontSize: 11, fontWeight: 400 }}
                        >
                          {v.brand} · {v.type}
                        </div>
                      </td>
                      {activeVendors.map((p) => {
                        const val = matrix[v.id]?.[p.id] || 0
                        return (
                          <td
                            key={p.id}
                            className="num right mono"
                            style={{
                              color: val > 0 ? 'var(--text-1)' : 'var(--text-faint)',
                              fontWeight: val > 0 ? 600 : 400,
                            }}
                          >
                            {fmt(val)}
                          </td>
                        )
                      })}
                      <td
                        className="num right mono"
                        style={{
                          background: 'var(--primary-50)',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          borderLeft: '2px solid var(--primary)',
                        }}
                      >
                        {fmt(rt)}
                      </td>
                    </tr>
                  )
                })}
                {/* Vendor totals row */}
                <tr
                  style={{
                    background: 'var(--green-50)',
                    borderTop: '2px solid var(--green)',
                    fontWeight: 700,
                  }}
                >
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: 'var(--green-50)',
                      zIndex: 1,
                      borderRight: '2px solid var(--line)',
                      color: '#166534',
                    }}
                  >
                    รวมยอดต่อคู่ค้า
                  </td>
                  {activeVendors.map((p) => (
                    <td
                      key={p.id}
                      className="num right mono"
                      style={{ color: '#166534', fontWeight: 700 }}
                    >
                      {fmt(colTotal(p.id))}
                    </td>
                  ))}
                  <td
                    className="num right mono"
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 14,
                      borderLeft: '2px solid var(--primary)',
                    }}
                  >
                    {fmt(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {activeVendors.length === 0 && (
            <div className="empty" style={{ padding: 40 }}>
              ไม่มีข้อมูลค่าใช้จ่ายในช่วงเวลาที่เลือก
            </div>
          )}
        </div>

        {/* Print footer */}
        <div
          className="print-only"
          style={{
            marginTop: 14,
            fontSize: 10,
            color: '#666',
            borderTop: '1px solid #ddd',
            paddingTop: 8,
          }}
        >
          KPS Transportation ERP — สรุปค่าใช้จ่ายรวมรายคัน × คู่ค้า · ตัวเลขในหน่วยบาท
        </div>
        </div>
      </div>

      {/* ── Print-only: portrait-friendly per-vehicle sections ──
         The on-screen pivot is too wide for A4; here each vehicle becomes
         its own block listing only the partners it actually paid. */}
      <div className="print-only pivot-portrait">
        {vehicles
          .filter((v) => rowTotal(v.id) > 0)
          .map((v) => {
            const rowsWithSpend = activeVendors
              .filter((p) => (matrix[v.id]?.[p.id] || 0) > 0)
              .sort((a, b) => (matrix[v.id]?.[b.id] || 0) - (matrix[v.id]?.[a.id] || 0))
            return (
              <div key={v.id} className="pivot-portrait-section">
                <div className="pivot-portrait-head">
                  <span className="plate">{v.plate}</span>
                  <span className="meta">{v.brand} · {v.type}</span>
                  <span className="total">รวม {db.thb(rowTotal(v.id))}</span>
                </div>
                <table className="pivot-portrait-tbl">
                  <tbody>
                    {rowsWithSpend.map((p) => (
                      <tr key={p.id}>
                        <td className="name">{p.name}</td>
                        <td className="type">{p.type}</td>
                        <td className="amount">{db.thb(matrix[v.id][p.id])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}

        {/* Per-vendor totals */}
        {activeVendors.length > 0 && (
          <div className="pivot-portrait-section pivot-portrait-summary">
            <div className="pivot-portrait-head">
              <span className="plate">รวมยอดต่อคู่ค้า</span>
              <span className="total">รวมทั้งสิ้น {db.thb(grandTotal)}</span>
            </div>
            <table className="pivot-portrait-tbl">
              <tbody>
                {[...activeVendors]
                  .sort((a, b) => colTotal(b.id) - colTotal(a.id))
                  .map((p) => (
                    <tr key={p.id}>
                      <td className="name">{p.name}</td>
                      <td className="type">{p.type}</td>
                      <td className="amount">{db.thb(colTotal(p.id))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
