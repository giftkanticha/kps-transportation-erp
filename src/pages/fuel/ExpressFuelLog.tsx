import React, { useState, useMemo } from 'react'
import { db, uid } from '../../lib/db'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { Icon } from '../../components/ui/Icon'
import { QuickOpenTripModal } from './QuickOpenTripModal'
import type { CSSProperties } from 'react'
import type { Vehicle, Dispatch as DispatchJob, FuelRecord, FuelStock, FuelTransaction } from '../../types'

type InsertFuelTx = ReturnType<typeof useInsert<FuelTransaction>>

// ─── Types ────────────────────────────────────────────────────────────────────

type FuelSource = 'FACTORY_TANK' | 'EXTERNAL_PUMP'
type RowStatus = 'PENDING' | 'INTERNAL_DEDUCTED' | 'TRIP_LINKED' | 'FLOATING' | 'ERROR' | 'REVERSED'

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
  txId: string
  fuelRecId: string
  reversed: boolean
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
    txId: '',
    fuelRecId: '',
    reversed: false,
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
  vehicles: Vehicle[],
  dispatches: DispatchJob[],
): { status: RowStatus; statusLabel: string; tripId: string | null; error: string } {
  const vehicle = vehicles.find(v => v.id === vehicleId)
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

  const group = vehicle.groupKind ?? 'TRANSPORT'
  if (group === 'INTERNAL') {
    return { status: 'INTERNAL_DEDUCTED', statusLabel: '🟢 ตัดสต็อค (รถโรงงาน)', tripId: null, error: '' }
  }

  const matches = dispatches.filter(d =>
    d.vehicleId === vehicleId &&
    d.date?.slice(0, 10) === date &&
    (d.status === 'scheduled' || d.status === 'in-progress'),
  )

  if (matches.length > 0) {
    const trip = matches[0]
    return { status: 'TRIP_LINKED', statusLabel: `🔵 ผูกรอบ ${trip.code}`, tripId: trip.id, error: '' }
  }

  return { status: 'FLOATING', statusLabel: '🟡 น้ำมันลอย — ยังไม่มีรอบงาน', tripId: null, error: '' }
}

async function persistRow(
  row: GridRow,
  vehicles: Vehicle[],
  insertFuelTx: InsertFuelTx,
): Promise<{ txId: string; fuelRecId: string }> {
  const vehicle = vehicles.find(v => v.id === row.vehicleId)
  const liters = parseFloat(row.liters)
  const pricePerL = parseFloat(row.pricePerL) || 35
  const total = liters * pricePerL
  const txId = uid('ftx')
  const fuelRecId = uid('f')

  await insertFuelTx.mutateAsync({
    id: txId,
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

  db.add<FuelRecord>('fuel', {
    id: fuelRecId,
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

  return { txId, fuelRecId }
}

// ─── Status badge styles ──────────────────────────────────────────────────────

const BADGE: Record<RowStatus, CSSProperties> = {
  PENDING: { color: '#9CA3AF', fontSize: 12 },
  INTERNAL_DEDUCTED: { background: '#F0FDF4', color: '#166534', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  TRIP_LINKED: { background: '#EFF6FF', color: '#1D4ED8', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  FLOATING: { background: '#FFFBEB', color: '#92400E', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  ERROR: { background: '#FEF2F2', color: '#991B1B', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  REVERSED: { background: '#F1F5F9', color: '#94A3B8', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textDecoration: 'line-through' },
}

const cellInput: CSSProperties = {
  height: 34,
  padding: '0 8px',
  border: '1px solid #93C5FD',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  background: '#EFF6FF',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

// ─── Confirm Delete Dialog ─────────────────────────────────────────────────────

function ConfirmReverseDialog({ plateTerm, liters, onConfirm, onCancel }: {
  plateTerm: string
  liters: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 380, padding: 24,
        boxShadow: '0 10px 40px rgba(0,0,0,.2)',
      }}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 16, fontWeight: 700 }}>ยืนยันการลบรายการ?</h3>
        <p style={{ margin: '0 0 20px', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
          ทะเบียน <strong>{plateTerm}</strong> · {liters} ลิตร<br />
          รายการนี้จะถูกยกเลิก และสต็อกจะถูกคืนอัตโนมัติ
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, background: '#DC2626', color: '#fff', border: 'none',
              borderRadius: 7, padding: '8px 0', cursor: 'pointer', fontSize: 13,
              fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            ✓ ยืนยันลบ
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Float toast type ─────────────────────────────────────────────────────────

interface FloatingToast {
  message: string
  vehicleId: string
  date: string
  floatingTxId: string
  plateTerm: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpressFuelLog({ setActive }: { setActive?: (page: string) => void }) {
  const [rows, setRows] = useState<GridRow[]>([makeRow()])
  const [toast, setToast] = useState<FloatingToast | null>(null)
  const [quickOpenCtx, setQuickOpenCtx] = useState<{ vehicleId: string; date: string; floatingTxId: string } | null>(null)
  const [tick, setTick] = useState(0)

  // Edit state
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ date: string; plateTerm: string; vehicleId: string; liters: string; pricePerL: string; source: FuelSource }>({
    date: '', plateTerm: '', vehicleId: '', liters: '', pricePerL: '35', source: 'FACTORY_TANK',
  })

  // Reverse confirm
  const [reverseTarget, setReverseTarget] = useState<GridRow | null>(null)

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: dispatches = [] } = useDispatches()
  const { data: allFuelTxs = [] } = useList<FuelTransaction>('fuel_transactions')
  const insertFuelTx = useInsert<FuelTransaction>('fuel_transactions')
  const updateFuelTx = useUpdate<FuelTransaction>('fuel_transactions')
  const balance = useMemo(() => getFactoryBalance(), [tick])
  const floatingCount = allFuelTxs.filter(t => t.status === 'FLOATING').length

  const refresh = () => setTick(t => t + 1)

  const patchRow = (i: number, patch: Partial<GridRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const handlePlateChange = (i: number, val: string) => {
    const found = vehicles.find(v => v.plate.toLowerCase() === val.trim().toLowerCase())
    patchRow(i, { plateTerm: val, vehicleId: found?.id ?? '' })
  }

  const commitAndAdvance = async (i: number) => {
    const row = rows[i]
    if (row.committed) {
      document.getElementById(`cell-${i + 1}-0`)?.focus()
      return
    }
    if (!row.vehicleId || !row.liters) {
      document.getElementById(`cell-${i + 1}-0`)?.focus()
      return
    }

    const result = autoRoute(row.vehicleId, row.date, row.source, parseFloat(row.liters), vehicles, dispatches)
    const updated: GridRow = { ...row, ...result, committed: result.status !== 'ERROR' }

    if (updated.committed) {
      const { txId, fuelRecId } = await persistRow(updated, vehicles, insertFuelTx)
      updated.txId = txId
      updated.fuelRecId = fuelRecId
      refresh()
      if (result.status === 'FLOATING') {
        setToast({
          message: `🟡 รถ ${row.plateTerm} — บันทึกแล้ว (น้ำมันลอย)`,
          vehicleId: row.vehicleId,
          date: row.date,
          floatingTxId: txId,
          plateTerm: row.plateTerm,
        })
        setTimeout(() => setToast(null), 8000)
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

  // ── Edit ────────────────────────────────────────────────────────────────────

  const startEdit = (row: GridRow) => {
    setEditingKey(row.key)
    setEditDraft({
      date: row.date,
      plateTerm: row.plateTerm,
      vehicleId: row.vehicleId,
      liters: row.liters,
      pricePerL: row.pricePerL,
      source: row.source,
    })
  }

  const cancelEdit = () => setEditingKey(null)

  const saveEdit = async (row: GridRow, i: number) => {
    const foundVehicle = vehicles.find(v => v.plate.toLowerCase() === editDraft.plateTerm.trim().toLowerCase())
    const vehicleId = foundVehicle?.id ?? row.vehicleId
    const liters = parseFloat(editDraft.liters)
    const pricePerL = parseFloat(editDraft.pricePerL) || 35
    const total = liters * pricePerL

    const result = autoRoute(vehicleId, editDraft.date, editDraft.source, liters, vehicles, dispatches)

    // Update FuelTransaction
    if (row.txId) {
      await updateFuelTx.mutateAsync({
        id: row.txId,
        patch: {
          date: editDraft.date,
          vehicleId,
          liters,
          pricePerL,
          total,
          source: editDraft.source,
          tripId: result.tripId,
          status: result.status as FuelTransaction['status'],
        },
      })
    }

    // Update FuelRecord (backward compat)
    if (row.fuelRecId) {
      db.update<FuelRecord>('fuel', row.fuelRecId, {
        date: editDraft.date,
        vehicleId,
        liters,
        pricePerL,
        total,
        station: editDraft.source === 'FACTORY_TANK' ? 'ถังโรงงาน' : 'ปั๊มภายนอก',
      })
    }

    patchRow(i, {
      date: editDraft.date,
      plateTerm: editDraft.plateTerm,
      vehicleId,
      liters: editDraft.liters,
      pricePerL: editDraft.pricePerL,
      source: editDraft.source,
      status: result.status,
      statusLabel: result.statusLabel,
      tripId: result.tripId,
    })

    setEditingKey(null)
    refresh()
  }

  // ── Reverse ──────────────────────────────────────────────────────────────────

  const confirmReverse = async (row: GridRow) => {
    // Mark FuelTransaction as REVERSED
    if (row.txId) {
      await updateFuelTx.mutateAsync({
        id: row.txId,
        patch: { status: 'REVERSED', reversedAt: new Date().toISOString() },
      })
    }

    // Remove FuelRecord so factory balance is restored
    if (row.fuelRecId) {
      try { db.remove('fuel', row.fuelRecId) } catch { /* already deleted */ }
    }

    setRows(prev => prev.map(r =>
      r.key === row.key
        ? { ...r, reversed: true, status: 'REVERSED', statusLabel: '🚫 ยกเลิกแล้ว' }
        : r,
    ))
    setReverseTarget(null)
    refresh()
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const uncommitted = rows.filter(r => !r.committed && (r.vehicleId || r.liters)).length
  const committed = rows.filter(r => r.committed && !r.reversed).length

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
          background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12,
          padding: '12px 16px', boxShadow: '0 4px 24px rgba(0,0,0,.18)',
          fontSize: 13, color: '#78350F', fontWeight: 500, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, width: '90vw',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{toast.message}</span>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setQuickOpenCtx({ vehicleId: toast.vehicleId, date: toast.date, floatingTxId: toast.floatingTxId })
                setToast(null)
              }}
              style={{
                flex: 1, background: '#0066CC', color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13,
                fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              🚚 เปิดรอบตอนนี้
            </button>
            <button
              onClick={() => { setToast(null); setActive?.('fuel.floating') }}
              style={{
                flex: 1, background: '#fff', color: '#92400E', border: '1px solid #FCD34D',
                borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13,
                fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              ผูกทีหลัง →
            </button>
          </div>
        </div>
      )}

      {/* Quick open trip modal */}
      {quickOpenCtx && (
        <QuickOpenTripModal
          vehicleId={quickOpenCtx.vehicleId}
          date={quickOpenCtx.date}
          floatingTxId={quickOpenCtx.floatingTxId}
          onClose={() => setQuickOpenCtx(null)}
          onSuccess={(code) => {
            setQuickOpenCtx(null)
            refresh()
            // Update row status in grid
            setRows(prev => prev.map(r =>
              r.txId === quickOpenCtx.floatingTxId
                ? { ...r, status: 'TRIP_LINKED', statusLabel: `🔵 ผูกรอบ ${code}` }
                : r,
            ))
          }}
        />
      )}

      {/* Confirm reverse dialog */}
      {reverseTarget && (
        <ConfirmReverseDialog
          plateTerm={reverseTarget.plateTerm}
          liters={reverseTarget.liters}
          onConfirm={() => confirmReverse(reverseTarget)}
          onCancel={() => setReverseTarget(null)}
        />
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
                {['#', 'วันที่', 'ทะเบียน', 'ลิตร', 'ราคา/ลิตร', 'แหล่งน้ำมัน', 'สถานะ', 'จัดการ'].map((h, hi) => (
                  <th key={hi} style={{
                    padding: '9px 12px',
                    textAlign: hi === 0 ? 'center' : hi >= 3 && hi <= 4 ? 'right' : hi === 7 ? 'center' : 'left',
                    color: '#64748B', fontSize: 11, fontWeight: 700,
                    width: [40, 130, 155, 95, 110, 165, undefined, 120][hi],
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isEditing = editingKey === row.key && row.committed && !row.reversed
                const locked = row.committed && !isEditing
                const rowBg = row.reversed ? '#F8FAFC'
                  : row.status === 'ERROR' ? '#FEF2F2'
                  : isEditing ? '#F0F9FF'
                  : locked ? '#FAFAFA'
                  : '#fff'
                const plateInvalid = !locked && row.plateTerm !== '' && !row.vehicleId

                return (
                  <tr
                    key={row.key}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: rowBg,
                      opacity: row.reversed ? 0.5 : 1,
                      transition: 'background .1s',
                    }}
                  >
                    {/* # */}
                    <td style={{ padding: '5px 12px', textAlign: 'center', color: '#CBD5E1', fontSize: 12 }}>{i + 1}</td>

                    {/* วันที่ */}
                    <td style={{ padding: '5px 7px' }}>
                      {isEditing ? (
                        <input
                          type="date"
                          value={editDraft.date}
                          onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
                          style={cellInput}
                        />
                      ) : (
                        <input
                          id={`cell-${i}-0`}
                          type="date"
                          value={row.date}
                          disabled={locked || row.reversed}
                          onChange={e => patchRow(i, { date: e.target.value })}
                          onKeyDown={onKeyDown(i, false)}
                          style={{ ...cellInput, border: '1px solid var(--line)', background: locked ? 'transparent' : '#fff', opacity: locked ? 0.55 : 1 }}
                        />
                      )}
                    </td>

                    {/* ทะเบียน */}
                    <td style={{ padding: '5px 7px' }}>
                      {isEditing ? (
                        <input
                          list="fuel-plates-dl"
                          value={editDraft.plateTerm}
                          onChange={e => {
                            const found = vehicles.find(v => v.plate.toLowerCase() === e.target.value.trim().toLowerCase())
                            setEditDraft(d => ({ ...d, plateTerm: e.target.value, vehicleId: found?.id ?? d.vehicleId }))
                          }}
                          style={cellInput}
                          placeholder="ทะเบียนรถ..."
                        />
                      ) : (
                        <input
                          id={`cell-${i}-1`}
                          list="fuel-plates-dl"
                          value={row.plateTerm}
                          disabled={locked || row.reversed}
                          onChange={e => handlePlateChange(i, e.target.value)}
                          onKeyDown={onKeyDown(i, false)}
                          placeholder="ทะเบียนรถ..."
                          style={{
                            ...cellInput,
                            border: plateInvalid ? '1px solid #EF4444' : '1px solid var(--line)',
                            background: plateInvalid ? '#FEF2F2' : locked ? 'transparent' : '#fff',
                            opacity: locked ? 0.55 : 1,
                          }}
                        />
                      )}
                    </td>

                    {/* ลิตร */}
                    <td style={{ padding: '5px 7px' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editDraft.liters}
                          onChange={e => setEditDraft(d => ({ ...d, liters: e.target.value }))}
                          style={{ ...cellInput, textAlign: 'right' }}
                        />
                      ) : (
                        <input
                          id={`cell-${i}-2`}
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.liters}
                          disabled={locked || row.reversed}
                          onChange={e => patchRow(i, { liters: e.target.value })}
                          onKeyDown={onKeyDown(i, false)}
                          placeholder="0.00"
                          style={{ ...cellInput, textAlign: 'right', border: '1px solid var(--line)', background: locked ? 'transparent' : '#fff', opacity: locked ? 0.55 : 1 }}
                        />
                      )}
                    </td>

                    {/* ราคา/ลิตร */}
                    <td style={{ padding: '5px 7px' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editDraft.pricePerL}
                          onChange={e => setEditDraft(d => ({ ...d, pricePerL: e.target.value }))}
                          style={{ ...cellInput, textAlign: 'right' }}
                        />
                      ) : (
                        <input
                          id={`cell-${i}-3`}
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.pricePerL}
                          disabled={locked || row.reversed}
                          onChange={e => patchRow(i, { pricePerL: e.target.value })}
                          onKeyDown={onKeyDown(i, false)}
                          style={{ ...cellInput, textAlign: 'right', border: '1px solid var(--line)', background: locked ? 'transparent' : '#fff', opacity: locked ? 0.55 : 1 }}
                        />
                      )}
                    </td>

                    {/* แหล่ง */}
                    <td style={{ padding: '5px 7px' }}>
                      {isEditing ? (
                        <select
                          value={editDraft.source}
                          onChange={e => setEditDraft(d => ({ ...d, source: e.target.value as FuelSource }))}
                          style={cellInput}
                        >
                          <option value="FACTORY_TANK">🏭 ถังโรงงาน</option>
                          <option value="EXTERNAL_PUMP">⛽ ปั๊มนอก</option>
                        </select>
                      ) : (
                        <select
                          id={`cell-${i}-4`}
                          value={row.source}
                          disabled={locked || row.reversed}
                          onChange={e => patchRow(i, { source: e.target.value as FuelSource })}
                          onKeyDown={onKeyDown(i, true)}
                          style={{ ...cellInput, cursor: (locked || row.reversed) ? 'default' : 'pointer', border: '1px solid var(--line)', background: locked ? 'transparent' : '#fff', opacity: locked ? 0.55 : 1 }}
                        >
                          <option value="FACTORY_TANK">🏭 ถังโรงงาน</option>
                          <option value="EXTERNAL_PUMP">⛽ ปั๊มนอก</option>
                        </select>
                      )}
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

                    {/* จัดการ */}
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                          <button
                            onClick={() => saveEdit(row, i)}
                            style={{
                              background: '#0066CC', color: '#fff', border: 'none',
                              borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                              fontSize: 11, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                            }}
                          >
                            ✓ บันทึก
                          </button>
                          <button
                            onClick={cancelEdit}
                            style={{
                              background: 'none', color: '#64748B', border: '1px solid #E2E8F0',
                              borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                              fontSize: 11, fontFamily: 'inherit',
                            }}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : row.committed && !row.reversed ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            onClick={() => startEdit(row)}
                            title="แก้ไข"
                            style={{
                              width: 28, height: 28, borderRadius: 6, border: '1px solid #E2E8F0',
                              cursor: 'pointer', background: 'transparent', color: '#64748B',
                              fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#0066CC'; e.currentTarget.style.borderColor = '#BFDBFE' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setReverseTarget(row)}
                            title="ลบ / ยกเลิก"
                            style={{
                              width: 28, height: 28, borderRadius: 6, border: '1px solid #E2E8F0',
                              cursor: 'pointer', background: 'transparent', color: '#CBD5E1',
                              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#FECACA' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                          >
                            🗑
                          </button>
                        </div>
                      ) : row.reversed ? (
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>ยกเลิกแล้ว</span>
                      ) : (
                        <button
                          onClick={() => removeRow(i)}
                          title="ลบแถว"
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: 'none',
                            cursor: 'pointer', background: 'transparent', color: '#CBD5E1',
                            fontSize: 17, lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1' }}
                        >×</button>
                      )}
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
            <button className="btn primary" onClick={commitAll} style={{ fontSize: 13 }}>
              บันทึกทั้งหมด ({uncommitted})
            </button>
          )}
          <button className="btn" onClick={() => { setRows([makeRow()]); refresh() }} style={{ fontSize: 13 }}>
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
        <span style={BADGE.REVERSED}>🚫 ยกเลิกแล้ว</span>
      </div>
    </div>
  )
}
