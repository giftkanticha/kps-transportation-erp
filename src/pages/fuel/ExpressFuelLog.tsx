import React, { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import { Icon } from '../../components/ui/Icon'
import type { CSSProperties } from 'react'
import type { Vehicle, Dispatch as DispatchJob, FuelRecord, FuelStock, FuelTransaction } from '../../types'

// ─── Types ────────────────────────────────────────────────────────────────────

type FuelSource = 'FACTORY_TANK' | 'EXTERNAL_PUMP'
type RowStatus = 'PENDING' | 'INTERNAL_DEDUCTED' | 'TRIP_LINKED' | 'FLOATING' | 'ERROR'

interface GridRow {
  key: string
  date: string
  plateTerm: string
  vehicleId: string
  liters: string
  pricePerL: string
  source: FuelSource
  status: RowStatus
  statusLabel: string
  tripId: string | null
  error: string
  committed: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10)

function makeRow(): GridRow {
  return {
    key: uid('row'),
    date: todayStr(),
    plateTerm: '',
    vehicleId: '',
    liters: '',
    pricePerL: '35',
    source: 'FACTORY_TANK',
    status: 'PENDING',
    statusLabel: '— รอคีย์',
    tripId: null,
    error: '',
    committed: false,
  }
}

function getFactoryBalance(): number {
  const stockIn = db.getAll<FuelStock>('fuelStock').reduce((s, r) => s + (r.liters || 0), 0)
  const stockOut = db.getAll<FuelRecord>('fuel')
    .filter(f => !['PTT', 'Shell', 'Bangchak', 'Esso'].some(b => f.station?.includes(b)))
    .reduce((s, r) => s + (r.liters || 0), 0)
  return Math.max(0, stockIn - stockOut)
}

function autoRoute(
  vehicleId: string,
  date: string,
  source: FuelSource,
  liters: number,
): { status: RowStatus; statusLabel: string; tripId: string | null; error: string } {
  const vehicle = db.get<Vehicle>('vehicles', vehicleId)
  if (!vehicle) return { status: 'ERROR', statusLabel: '❌ ไม่พบทะเบียนในระบบ', tripId: null, error: 'ไม่พบทะเบียน' }
  if (liters <= 0) return { status: 'ERROR', statusLabel: '❌ กรุณาระบุปริมาณน้ำมัน', tripId: null, error: 'ปริมาณต้องมากกว่า 0' }

  if (source === 'FACTORY_TANK') {
    const balance = getFactoryBalance()
    if (liters > balance) {
      return {
        status: 'ERROR',
        statusLabel: `❌ สต็อคไม่พอ (คงเหลือ ${balance.toFixed(0)} ล.)`,
        tripId: null,
        error: `สต็อคคลังไม่เพียงพอ — คงเหลือ ${balance.toFixed(2)} ลิตร`,
      }
    }
  }

  const group = vehicle.group ?? 'TRANSPORT'

  if (group === 'INTERNAL') {
    return { status: 'INTERNAL_DEDUCTED', statusLabel: '🟢 ตัดสต็อค (รถโรงงาน)', tripId: null, error: '' }
  }

  // TRANSPORT: find active/scheduled dispatch for this vehicle on this date
  const dispatches = db.getAll<DispatchJob>('dispatch').filter(d =>
    d.vehicleId === vehicleId &&
    d.date?.slice(0, 10) === date &&
    (d.status === 'scheduled' || d.status === 'in-progress'),
  )

  if (dispatches.length > 0) {
    const trip = dispatches[0]
    return { status: 'TRIP_LINKED', statusLabel: `🔵 ผูกรอบ ${trip.code}`, tripId: trip.id, error: '' }
  }

  return { status: 'FLOATING', statusLabel: '🟡 น้ำมันลอย — ยังไม่มีรอบงาน', tripId: null, error: '' }
}

function persistRow(row: GridRow): void {
  const vehicle = db.get<Vehicle>('vehicles', row.vehicleId)
  const liters = parseFloat(row.liters)
  const pricePerL = parseFloat(row.pricePerL) || 35
  const total = liters * pricePerL

  // Enhanced FuelTransaction record with routing metadata
  db.add<FuelTransaction>('fuelTransactions', {
    id: uid('ftx'),
    date: row.date,
    vehicleId: row.vehicleId,
    liters,
    pricePerL,
    total,
    source: row.source,
    tripId: row.tripId,
    status: row.status as 'INTERNAL_DEDUCTED' | 'TRIP_LINKED' | 'FLOATING',
    tripFuelRole: 'NORMAL',
    entryMethod: 'EXPRESS_GRID',
    createdAt: new Date().toISOString(),
    reversedAt: null,
    reversalOf: null,
  })

  // Also write FuelRecord for backward-compat with FuelInventorySummary reports
  db.add<FuelRecord>('fuel', {
    id: uid('f'),
    code: `EXP-${row.date.replace(/-/g, '')}`,
    vehicleId: row.vehicleId,
    driverId: vehicle?.driverId ?? '',
    station: row.source === 'FACTORY_TANK' ? 'ถังโรงงาน' : 'ปั๊มภายนอก',
    liters,
    pricePerL,
    total,
    odometer: 0,
    date: row.date,
    type: 'diesel',
  })
}

// ─── Status badge styles ──────────────────────────────────────────────────────

const BADGE: Record<RowStatus, CSSProperties> = {
  PENDING: { color: '#9CA3AF', fontSize: 12 },
  INTERNAL_DEDUCTED: { background: '#F0FDF4', color: '#166534', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  TRIP_LINKED: { background: '#EFF6FF', color: '#1D4ED8', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  FLOATING: { background: '#FFFBEB', color: '#92400E', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  ERROR: { background: '#FEF2F2', color: '#991B1B', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
}

const cellInput: CSSProperties = {
  height: 36,
  padding: '0 9px',
  border: '1px solid var(--line)',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpressFuelLog() {
  const [rows, setRows] = useState<GridRow[]>([makeRow()])
  const [toast, setToast] = useState('')
  const [tick, setTick] = useState(0)

  const vehicles = useMemo(() => db.getAll<Vehicle>('vehicles'), [tick])
  const balance = useMemo(() => getFactoryBalance(), [tick])
  const floatingCount = useMemo(
    () => db.getAll<FuelTransaction>('fuelTransactions').filter(t => t.status === 'FLOATING').length,
    [tick],
  )

  const refresh = () => setTick(t => t + 1)

  const patchRow = (i: number, patch: Partial<GridRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const handlePlateChange = (i: number, val: string) => {
    const found = vehicles.find(v => v.plate.toLowerCase() === val.trim().toLowerCase())
    patchRow(i, { plateTerm: val, vehicleId: found?.id ?? '' })
  }

  const commitAndAdvance = (i: number) => {
    const row = rows[i]
    if (row.committed) {
      document.getElementById(`cell-${i + 1}-0`)?.focus()
      return
    }
    if (!row.vehicleId || !row.liters) {
      document.getElementById(`cell-${i + 1}-0`)?.focus()
      return
    }

    const result = autoRoute(row.vehicleId, row.date, row.source, parseFloat(row.liters))
    const updated: GridRow = { ...row, ...result, committed: result.status !== 'ERROR' }

    if (updated.committed) {
      persistRow(updated)
      refresh()
      if (result.status === 'FLOATING') {
        setToast(`🟡 รถ ${row.plateTerm} — บันทึกแล้ว (น้ำมันลอย) สามารถผูกรอบได้ที่เมนู "น้ำมันลอย"`)
        setTimeout(() => setToast(''), 6000)
      }
    }

    setRows(prev => {
      const next = prev.map((r, idx) => idx === i ? updated : r)
      return updated.committed && i === prev.length - 1 ? [...next, makeRow()] : next
    })

    setTimeout(() => {
      const nextIdx = updated.committed ? i + 1 : i
      document.getElementById(`cell-${nextIdx}-0`)?.focus()
    }, 40)
  }

  const onKeyDown = (i: number, isLastCol: boolean) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitAndAdvance(i)
    } else if (e.key === 'Tab' && isLastCol) {
      e.preventDefault()
      commitAndAdvance(i)
    }
  }

  const removeRow = (i: number) =>
    setRows(prev => prev.length === 1 ? [makeRow()] : prev.filter((_, idx) => idx !== i))

  const commitAll = () => {
    rows.forEach((row, i) => {
      if (!row.committed && row.vehicleId && row.liters) commitAndAdvance(i)
    })
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const uncommitted = rows.filter(r => !r.committed && (r.vehicleId || r.liters)).length
  const committed = rows.filter(r => r.committed).length

  return (
    <div>
      {/* Header */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">⚡ คีย์ด่วนน้ำมัน (Express Fuel Log)</h1>
          <div className="page-sub">
            กด <kbd style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>Enter</kbd> เพื่อบันทึกแถวและขึ้นบรรทัดใหม่ · รองรับ Keyboard-only
          </div>
        </div>
        <div className="actions">
          {uncommitted > 0 && (
            <button className="btn primary" onClick={commitAll}>
              <Icon name="plus" size={14} /> บันทึกทั้งหมด ({uncommitted} แถว)
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid-4 no-print" style={{ marginBottom: 18, gap: 14 }}>
        <div className="card kpi">
          <div className="label">คลังน้ำมันคงเหลือ</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: balance > 200 ? '#166534' : '#991B1B' }}>
            {fmt(balance)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ลิตร</span>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>อัปเดตหลังบันทึกแต่ละแถว</div>
        </div>
        <div className="card kpi">
          <div className="label">แถวที่รอบันทึก</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: uncommitted > 0 ? '#92400E' : '#166534' }}>
            {uncommitted} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>แถว</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">บันทึกแล้วในเซสชันนี้</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: 'var(--primary)' }}>
            {committed} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>แถว</span>
          </div>
        </div>
        <div className="card kpi" style={{ background: floatingCount > 0 ? '#FFFBEB' : undefined, border: floatingCount > 0 ? '1px solid #FDE68A' : undefined }}>
          <div className="label" style={{ color: floatingCount > 0 ? '#92400E' : undefined }}>น้ำมันลอย (รอผูกรอบ)</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: floatingCount > 0 ? '#92400E' : '#166534' }}>
            {floatingCount} <span style={{ fontSize: 12 }}>รายการ</span>
          </div>
        </div>
      </div>

      {/* Floating toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
          padding: '10px 20px', boxShadow: '0 4px 20px rgba(0,0,0,.15)',
          fontSize: 13, color: '#78350F', fontWeight: 500, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 12, maxWidth: 540,
        }}>
          <span style={{ flex: 1 }}>{toast}</span>
          <button onClick={() => setToast('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Vehicle datalist */}
      <datalist id="fuel-plates-dl">
        {vehicles.map(v => <option key={v.id} value={v.plate}>{v.plate} · {v.brand}</option>)}
      </datalist>

      {/* Grid card */}
      <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', background: '#fff' }}>
        {/* Card header */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>ตารางคีย์น้ำมัน</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            กด <kbd style={{ background: '#fff', border: '1px solid #CBD5E1', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Enter</kbd> ที่ช่องสุดท้ายของแถวเพื่อบันทึก
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setRows(prev => [...prev, makeRow()])}
            style={{ background: 'none', border: '1px solid #CBD5E1', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#64748B' }}
          >
            + เพิ่มแถว
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                {['#', 'วันที่', 'ทะเบียน', 'ลิตร', 'ราคา/ลิตร', 'แหล่งน้ำมัน', 'สถานะ', ''].map((h, hi) => (
                  <th key={hi} style={{
                    padding: '9px 12px',
                    textAlign: hi === 0 || hi === 7 ? 'center' : hi >= 3 && hi <= 4 ? 'right' : 'left',
                    color: '#64748B', fontSize: 11, fontWeight: 700,
                    width: [40, 130, 155, 95, 110, 165, undefined, 36][hi],
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const locked = row.committed
                const rowBg = row.status === 'ERROR' ? '#FEF2F2' : locked ? '#FAFAFA' : '#fff'
                const plateInvalid = !locked && row.plateTerm !== '' && !row.vehicleId

                return (
                  <tr key={row.key} style={{ borderBottom: '1px solid #F1F5F9', background: rowBg, transition: 'background .1s' }}>
                    {/* # */}
                    <td style={{ padding: '5px 12px', textAlign: 'center', color: '#CBD5E1', fontSize: 12 }}>{i + 1}</td>

                    {/* วันที่ */}
                    <td style={{ padding: '5px 7px' }}>
                      <input
                        id={`cell-${i}-0`}
                        type="date"
                        value={row.date}
                        disabled={locked}
                        onChange={e => patchRow(i, { date: e.target.value })}
                        onKeyDown={onKeyDown(i, false)}
                        style={{ ...cellInput, opacity: locked ? 0.55 : 1 }}
                      />
                    </td>

                    {/* ทะเบียน */}
                    <td style={{ padding: '5px 7px' }}>
                      <input
                        id={`cell-${i}-1`}
                        list="fuel-plates-dl"
                        value={row.plateTerm}
                        disabled={locked}
                        onChange={e => handlePlateChange(i, e.target.value)}
                        onKeyDown={onKeyDown(i, false)}
                        placeholder="ทะเบียนรถ..."
                        style={{
                          ...cellInput,
                          opacity: locked ? 0.55 : 1,
                          borderColor: plateInvalid ? '#EF4444' : undefined,
                          background: plateInvalid ? '#FEF2F2' : undefined,
                        }}
                      />
                    </td>

                    {/* ลิตร */}
                    <td style={{ padding: '5px 7px' }}>
                      <input
                        id={`cell-${i}-2`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.liters}
                        disabled={locked}
                        onChange={e => patchRow(i, { liters: e.target.value })}
                        onKeyDown={onKeyDown(i, false)}
                        placeholder="0.00"
                        style={{ ...cellInput, textAlign: 'right', opacity: locked ? 0.55 : 1 }}
                      />
                    </td>

                    {/* ราคา/ลิตร */}
                    <td style={{ padding: '5px 7px' }}>
                      <input
                        id={`cell-${i}-3`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.pricePerL}
                        disabled={locked}
                        onChange={e => patchRow(i, { pricePerL: e.target.value })}
                        onKeyDown={onKeyDown(i, false)}
                        style={{ ...cellInput, textAlign: 'right', opacity: locked ? 0.55 : 1 }}
                      />
                    </td>

                    {/* แหล่ง */}
                    <td style={{ padding: '5px 7px' }}>
                      <select
                        id={`cell-${i}-4`}
                        value={row.source}
                        disabled={locked}
                        onChange={e => patchRow(i, { source: e.target.value as FuelSource })}
                        onKeyDown={onKeyDown(i, true)}
                        style={{ ...cellInput, cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.55 : 1 }}
                      >
                        <option value="FACTORY_TANK">🏭 ถังโรงงาน</option>
                        <option value="EXTERNAL_PUMP">⛽ ปั๊มนอก</option>
                      </select>
                    </td>

                    {/* สถานะ */}
                    <td style={{ padding: '5px 12px' }}>
                      {row.status !== 'PENDING' ? (
                        <span style={BADGE[row.status]}>
                          {row.status === 'ERROR' ? (row.error || row.statusLabel) : row.statusLabel}
                        </span>
                      ) : (
                        <span style={BADGE.PENDING}>{row.statusLabel}</span>
                      )}
                    </td>

                    {/* Delete */}
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeRow(i)}
                        title="ลบแถว"
                        style={{
                          width: 26, height: 26, borderRadius: 6, border: 'none',
                          cursor: 'pointer', background: 'transparent',
                          color: '#CBD5E1', fontSize: 17, lineHeight: '1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1' }}
                      >×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {committed} แถวบันทึกแล้ว
            {uncommitted > 0 && <span style={{ color: '#92400E', marginLeft: 8 }}>· {uncommitted} แถวรอบันทึก</span>}
          </span>
          <div style={{ flex: 1 }} />
          {uncommitted > 0 && (
            <button
              className="btn primary"
              onClick={commitAll}
              style={{ fontSize: 13 }}
            >
              บันทึกทั้งหมด ({uncommitted})
            </button>
          )}
          <button
            className="btn"
            onClick={() => { setRows([makeRow()]); refresh() }}
            style={{ fontSize: 13 }}
          >
            ล้างตาราง
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#64748B' }}>
        <span style={BADGE.INTERNAL_DEDUCTED}>🟢 ตัดสต็อค (รถโรงงาน)</span>
        <span style={BADGE.TRIP_LINKED}>🔵 ผูกรอบงาน</span>
        <span style={BADGE.FLOATING}>🟡 น้ำมันลอย — รอผูกรอบ</span>
        <span style={BADGE.ERROR}>❌ พบข้อผิดพลาด</span>
      </div>
    </div>
  )
}
