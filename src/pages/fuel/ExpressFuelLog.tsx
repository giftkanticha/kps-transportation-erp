import React, { useState, useMemo, useEffect } from 'react'
import { uid } from '../../lib/db'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { Icon } from '../../components/ui/Icon'
import { QuickOpenTripModal } from './QuickOpenTripModal'
import type { CSSProperties } from 'react'
import type { Vehicle, Dispatch as DispatchJob, FuelRecord, FuelStock, FuelTransaction, FuelDailyPrice } from '../../types'
import { priceForDate } from './FuelDailyPricesPage'

type InsertFuelTx = ReturnType<typeof useInsert<FuelTransaction>>
type InsertFuelRec = ReturnType<typeof useInsert<FuelRecord>>
type UpdateDispatchFn = ReturnType<typeof useUpdate<DispatchJob>>

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
  // เลขไมล์ปลายรอบ — กรอกเมื่อปิดรอบ (เติม+จดไมล์ที่โรงงานพร้อมกัน). ว่าง = แถวน้ำมันปกติ
  odometer: string
  source: FuelSource
  status: RowStatus
  statusLabel: string
  tripId: string | null
  // 'TRIP_CLOSING' เมื่อแถวนี้เป็นน้ำมันปิดรอบ (ผูกกับรอบ draft), ปกติ 'NORMAL'
  tripFuelRole: 'NORMAL' | 'TRIP_CLOSING'
  closingRoundId: string | null
  error: string
  committed: boolean
  txId: string
  fuelRecId: string
  reversed: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10)

function makeRow(source: FuelSource = 'FACTORY_TANK'): GridRow {
  return {
    key: uid('row'),
    date: todayStr(),
    plateTerm: '',
    vehicleId: '',
    liters: '',
    // ราคาคลังโรงงาน auto-fill ทีหลัง (default 35); ปั๊มนอกให้คนขับกรอกเอง
    pricePerL: source === 'FACTORY_TANK' ? '35' : '',
    odometer: '',
    source,
    status: 'PENDING',
    statusLabel: '— รอคีย์',
    tripId: null,
    tripFuelRole: 'NORMAL',
    closingRoundId: null,
    error: '',
    committed: false,
    txId: '',
    fuelRecId: '',
    reversed: false,
  }
}

function getFactoryBalance(stocks: FuelStock[], fuelRecords: FuelRecord[]): number {
  // Only fuel_records tagged as factory tank consume from the on-site stock.
  // External-pump fills are an AP cost, not an inventory draw. The previous
  // 'NOT in PTT/Shell/…' filter mis-classified the Thai 'ปั๊มภายนอก' string
  // as factory and was bleeding external pumps out of the tank balance.
  const stockIn = stocks.reduce((s, r) => s + (r.liters || 0), 0)
  const stockOut = fuelRecords
    .filter(f => f.station === 'ถังโรงงาน')
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
  stocks: FuelStock[],
  fuelRecords: FuelRecord[],
): { status: RowStatus; statusLabel: string; tripId: string | null; error: string } {
  const vehicle = vehicles.find(v => v.id === vehicleId)
  if (!vehicle) return { status: 'ERROR', statusLabel: '❌ ไม่พบทะเบียนในระบบ', tripId: null, error: 'ไม่พบทะเบียน' }
  if (liters <= 0) return { status: 'ERROR', statusLabel: '❌ กรุณาระบุปริมาณน้ำมัน', tripId: null, error: 'ปริมาณต้องมากกว่า 0' }

  if (source === 'FACTORY_TANK') {
    const balance = getFactoryBalance(stocks, fuelRecords)
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

// หา "รอบที่เปิดค้างรอปิด" ของรถคันนี้เพื่อผูกน้ำมันปิดรอบ + เลขไมล์ปลาย.
// สัญญาณรอบเปิดค้างของระบบคือ roundStatus === 'draft' (เหมือนหน้าปิดงาน) — ไม่ใช่
// status เพราะรอบ draft อาจยังเป็น 'scheduled' อยู่. รอบมักเปิดคนละวันกับวันปิด
// (ทริปหลายวัน) จึงใช้ logic นี้แยกจาก autoRoute ที่ผูกแบบ same-date.
function findOpenRoundForClosing(
  vehicleId: string,
  closingDate: string,
  dispatches: DispatchJob[],
): { round: DispatchJob | null; ambiguous: DispatchJob[] } {
  const drafts = dispatches.filter(
    d => d.vehicleId === vehicleId && d.roundStatus === 'draft' && d.locked !== true,
  )
  if (drafts.length === 0) return { round: null, ambiguous: [] }

  // ทริปจะปิดในวันเดียวกันหรือหลังวันเปิด → เลือกรอบที่เปิด <= วันปิด เรียงใหม่→เก่า.
  // ถ้าไม่มี (วันปิดถูก backdate ก่อนวันเปิด) ให้ fallback เป็น draft ล่าสุด.
  const onOrBefore = drafts
    .filter(d => (d.date?.slice(0, 10) ?? '') <= closingDate)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const pool = onOrBefore.length > 0
    ? onOrBefore
    : [...drafts].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return { round: pool[0], ambiguous: pool.length > 1 ? pool : [] }
}

async function persistRow(
  row: GridRow,
  vehicles: Vehicle[],
  insertFuelTx: InsertFuelTx,
  insertFuelRec: InsertFuelRec,
  updateDispatch: UpdateDispatchFn,
  closingRound: DispatchJob | null,
  totalOverride?: number,
): Promise<{ txId: string; fuelRecId: string }> {
  const vehicle = vehicles.find(v => v.id === row.vehicleId)
  const liters = parseFloat(row.liters)
  const pricePerL = parseFloat(row.pricePerL) || 35
  const total = totalOverride != null ? totalOverride : liters * pricePerL
  const txId = uid('ftx')
  const fuelRecId = uid('f')
  const isClosing = row.tripFuelRole === 'TRIP_CLOSING'
  const odometer = row.odometer ? Number(row.odometer) : 0

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
    // น้ำมันปิดรอบจากคีย์ด่วน → TRIP_CLOSING + entryMethod 'EXPRESS_GRID' (ตัวที่
    // หน้าปิดงานใช้ตรวจ hasExternalClosing แล้วข้ามการสร้างซ้ำ)
    tripFuelRole: row.tripFuelRole,
    entryMethod: 'EXPRESS_GRID',
    createdAt: new Date().toISOString(),
    reversedAt: null,
    reversalOf: null,
    ...(isClosing ? { note: `น้ำมันปิดรอบ (คีย์ด่วน) สำหรับรอบ ${closingRound?.code ?? ''}` } : {}),
  })

  await insertFuelRec.mutateAsync({
    id: fuelRecId,
    code: `EXP-${row.date.replace(/-/g, '')}-${fuelRecId.slice(-6)}`,
    vehicleId: row.vehicleId,
    driverId: vehicle?.driverId || null,
    station: row.source === 'FACTORY_TANK' ? 'ถังโรงงาน' : 'ปั๊มภายนอก',
    liters,
    pricePerL,
    total,
    odometer,
    date: row.date,
    type: 'diesel',
    // น้ำมันปิดรอบ: ให้ค่าใช้จ่ายตกเดือนของรอบ (วันเปิดรอบ) ไม่ใช่วันเติมจริงที่
    // อาจข้ามเดือน — ตรงกับพฤติกรรมหน้าปิดงาน
    ...(isClosing && closingRound?.date ? { accountingDate: closingRound.date } : {}),
  })

  // ผูกเลขไมล์ปลาย + น้ำมันปิดรอบเข้ากับรอบ แต่ยังคงเป็น draft — ผู้ใช้ไปกรอก
  // น้ำหนัก/เบี้ยเลี้ยง/เวลาถึงในหน้าปิดงานเพื่อปิดจริงทีหลัง
  if (isClosing && closingRound) {
    await updateDispatch.mutateAsync({
      id: closingRound.id,
      patch: {
        endOdometer: odometer,
        closingFuelLiters: liters,
        closingFuelPrice: pricePerL,
      },
    })
  }

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
  // แหล่งน้ำมันเริ่มต้นแบบรวม — ตั้งทีเดียวใช้กับทุกแถวที่ยังไม่บันทึก เพื่อคีย์เร็ว
  const [globalSource, setGlobalSource] = useState<FuelSource>('FACTORY_TANK')
  const [rows, setRows] = useState<GridRow[]>([makeRow()])
  const [toast, setToast] = useState<FloatingToast | null>(null)
  const [quickOpenCtx, setQuickOpenCtx] = useState<{ vehicleId: string; date: string; floatingTxId: string } | null>(null)

  // Edit state
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ date: string; plateTerm: string; vehicleId: string; liters: string; pricePerL: string; odometer: string; source: FuelSource }>({
    date: '', plateTerm: '', vehicleId: '', liters: '', pricePerL: '35', odometer: '', source: 'FACTORY_TANK',
  })

  // Reverse confirm
  const [reverseTarget, setReverseTarget] = useState<GridRow | null>(null)

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: dispatches = [] } = useDispatches()
  const { data: allFuelTxs = [] } = useList<FuelTransaction>('fuel_transactions')
  const { data: fuelStock = [] } = useList<FuelStock>('fuel_stock')
  const { data: fuelRecords = [] } = useList<FuelRecord>('fuel_records')
  const { data: dailyPrices = [] } = useList<FuelDailyPrice>('fuel_daily_prices', 'date', false)

  // Auto-fill only for FACTORY_TANK — external pump prices vary per station
  // / province so the driver always types from the receipt.
  useEffect(() => {
    if (dailyPrices.length === 0) return
    setRows(prev => prev.map(r => {
      if (r.committed || r.reversed) return r
      if (r.source !== 'FACTORY_TANK') return r
      const p = priceForDate(dailyPrices, 'FACTORY_TANK', r.date)
      if (p == null) return r
      return r.pricePerL === String(p) ? r : { ...r, pricePerL: String(p) }
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyPrices])
  const insertFuelTx = useInsert<FuelTransaction>('fuel_transactions')
  const updateFuelTx = useUpdate<FuelTransaction>('fuel_transactions')
  const insertFuelRec = useInsert<FuelRecord>('fuel_records')
  const updateFuelRec = useUpdate<FuelRecord>('fuel_records')
  const deleteFuelRec = useDelete('fuel_records')
  const updateDispatch = useUpdate<DispatchJob>('dispatch')
  const balance = useMemo(() => getFactoryBalance(fuelStock, fuelRecords), [fuelStock, fuelRecords])
  const floatingCount = allFuelTxs.filter(t => t.status === 'FLOATING').length

  const patchRow = (i: number, patch: Partial<GridRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const handlePlateChange = (i: number, val: string) => {
    const found = vehicles.find(v => v.plate.toLowerCase() === val.trim().toLowerCase())
    patchRow(i, { plateTerm: val, vehicleId: found?.id ?? '' })
  }

  // ปุ่มสลับแหล่งน้ำมันแบบรวม — apply กับแถวที่ยังไม่บันทึก/ไม่ยกเลิก และ "ไม่ใช่แถว
  // ปิดรอบ" (แถวปิดรอบล็อกเป็นคลังโรงงานเสมอ). ราคา sync เหมือน select รายแถว.
  const applyGlobalSource = (s: FuelSource) => {
    setGlobalSource(s)
    setRows(prev => prev.map(r => {
      if (r.committed || r.reversed || r.odometer.trim() !== '') return r
      if (s === 'FACTORY_TANK') {
        const auto = priceForDate(dailyPrices, 'FACTORY_TANK', r.date)
        return auto != null ? { ...r, source: s, pricePerL: String(auto) } : { ...r, source: s }
      }
      return { ...r, source: s, pricePerL: '' }
    }))
  }

  // ป้ายบอกใบ้ใต้ช่องเลขไมล์: รอบ draft ที่จะถูกผูกเมื่อบันทึก (หรือเตือนถ้าไม่พบ)
  const closingHint = (r: GridRow) => {
    if (!r.vehicleId || r.odometer.trim() === '') return null
    const { round } = findOpenRoundForClosing(r.vehicleId, r.date, dispatches)
    return round
      ? <div style={{ fontSize: 10, color: '#1D4ED8', marginTop: 2 }}>🔵 ปิดรอบ {round.code}</div>
      : <div style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }}>ไม่พบรอบเปิดค้าง</div>
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

    const liters = parseFloat(row.liters)
    let updated: GridRow
    let totalOverride: number | undefined
    let closingRound: DispatchJob | null = null

    if (row.odometer.trim() !== '') {
      // ── แถวปิดรอบ: กรอกเลขไมล์ → ผูกเป็นน้ำมันปิดรอบ (TRIP_CLOSING) ของรอบที่
      //    เปิดค้างของรถคันนี้ + เขียน endOdometer ลงรอบ (รอบยังเป็น draft)
      const { round, ambiguous } = findOpenRoundForClosing(row.vehicleId, row.date, dispatches)
      if (!round) {
        patchRow(i, { status: 'ERROR', statusLabel: '❌ ไม่พบรอบเปิดค้างของรถคันนี้', error: 'ไม่พบรอบเปิดค้าง', committed: false })
        return
      }
      const odo = Number(row.odometer)
      if (isNaN(odo)) {
        patchRow(i, { status: 'ERROR', statusLabel: '❌ เลขไมล์ไม่ถูกต้อง', error: 'เลขไมล์ไม่ถูกต้อง', committed: false })
        return
      }
      if (round.startOdometer != null && odo <= round.startOdometer) {
        patchRow(i, { status: 'ERROR', statusLabel: '❌ เลขไมล์ปลายต้องมากกว่าต้นรอบ', error: 'เลขไมล์ปลายต้องมากกว่าต้นรอบ', committed: false })
        return
      }
      if (liters <= 0) {
        patchRow(i, { status: 'ERROR', statusLabel: '❌ กรุณาระบุปริมาณน้ำมัน', error: 'ปริมาณต้องมากกว่า 0', committed: false })
        return
      }
      // น้ำมันปิดรอบ = คลังโรงงานเสมอ → ต้องไม่เกินยอดคงเหลือในคลัง
      const fbal = getFactoryBalance(fuelStock, fuelRecords)
      if (liters > fbal) {
        patchRow(i, { status: 'ERROR', statusLabel: `❌ สต็อคไม่พอ (คงเหลือ ${fbal.toFixed(0)} ล.)`, error: `สต็อคคลังไม่เพียงพอ — คงเหลือ ${fbal.toFixed(2)} ลิตร`, committed: false })
        return
      }
      // กันคีย์ซ้ำ: รอบนี้มีน้ำมันปิดรอบอยู่แล้ว
      const existingClosing = allFuelTxs.find(
        t => t.tripId === round.id && t.tripFuelRole === 'TRIP_CLOSING' && t.status !== 'REVERSED',
      )
      if (existingClosing && !confirm(`รอบ ${round.code} มีน้ำมันปิดรอบอยู่แล้ว\n\nต้องการเพิ่มอีกรายการหรือไม่?`)) return
      // มีหลายรอบเปิดค้าง → ยืนยันก่อนผูกกับรอบล่าสุด (ไม่เงียบ ๆ เลือกเอง)
      if (ambiguous.length > 1 && !confirm(`รถคันนี้มีรอบเปิดค้าง ${ambiguous.length} รอบ\nจะผูกน้ำมันปิดรอบกับรอบล่าสุด: ${round.code}\n\nตกลงหรือไม่?`)) return

      closingRound = round
      updated = {
        ...row,
        source: 'FACTORY_TANK',
        status: 'TRIP_LINKED',
        statusLabel: `🔵 ปิดรอบ ${round.code} (ไมล์ปลาย ${odo.toLocaleString()})`,
        tripId: round.id,
        closingRoundId: round.id,
        tripFuelRole: 'TRIP_CLOSING',
        error: '',
        committed: true,
      }
    } else {
      // ── แถวน้ำมันปกติ: ผูกรอบแบบ same-date เดิม
      const result = autoRoute(row.vehicleId, row.date, row.source, liters, vehicles, dispatches, fuelStock, fuelRecords)
      updated = { ...row, ...result, tripFuelRole: 'NORMAL', closingRoundId: null, committed: result.status !== 'ERROR' }

      // External-pump receipts are usually paid as a whole baht — the
      // liters×price often lands on a .xx fraction (e.g. 1,999.55). Offer to
      // round up to the next baht so the AP figure matches the receipt.
      if (updated.committed && row.source === 'EXTERNAL_PUMP') {
        const raw = liters * (parseFloat(row.pricePerL) || 35)
        const ceil = Math.ceil(raw)
        if (raw > 0 && Math.abs(ceil - raw) > 0.001) {
          if (confirm(`ยอดปั๊มภายนอก = ${raw.toFixed(2)} บาท\n\nตกลง = ปัดขึ้นเป็น ${ceil.toLocaleString()} บาท\nยกเลิก = ใช้ยอดตามจริง ${raw.toFixed(2)} บาท`)) {
            totalOverride = ceil
          }
        }
      }
    }

    if (updated.committed) {
      const { txId, fuelRecId } = await persistRow(updated, vehicles, insertFuelTx, insertFuelRec, updateDispatch, closingRound, totalOverride)
      updated.txId = txId
      updated.fuelRecId = fuelRecId
      if (updated.status === 'FLOATING') {
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
      return updated.committed && i === prev.length - 1 ? [...next, makeRow(globalSource)] : next
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
    setRows(prev => prev.length === 1 ? [makeRow(globalSource)] : prev.filter((_, idx) => idx !== i))

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
      odometer: row.odometer,
      source: row.source,
    })
  }

  const cancelEdit = () => setEditingKey(null)

  const saveEdit = async (row: GridRow, i: number) => {
    try {
      const foundVehicle = vehicles.find(v => v.plate.toLowerCase() === editDraft.plateTerm.trim().toLowerCase())
      const vehicleId = foundVehicle?.id ?? row.vehicleId
      const liters = parseFloat(editDraft.liters)
      const pricePerL = parseFloat(editDraft.pricePerL) || 35
      const total = liters * pricePerL

      const wantClosing = editDraft.odometer.trim() !== ''
      let nextStatus: RowStatus
      let nextLabel: string
      let nextTripId: string | null
      let nextRole: 'NORMAL' | 'TRIP_CLOSING'
      let nextSource: FuelSource = editDraft.source
      let closingRound: DispatchJob | null = null

      if (wantClosing) {
        const { round } = findOpenRoundForClosing(vehicleId, editDraft.date, dispatches)
        if (!round) { alert('ไม่พบรอบเปิดค้างของรถคันนี้'); return }
        const odo = Number(editDraft.odometer)
        if (isNaN(odo)) { alert('เลขไมล์ไม่ถูกต้อง'); return }
        if (round.startOdometer != null && odo <= round.startOdometer) { alert('เลขไมล์ปลายต้องมากกว่าต้นรอบ'); return }
        closingRound = round
        nextStatus = 'TRIP_LINKED'
        nextLabel = `🔵 ปิดรอบ ${round.code} (ไมล์ปลาย ${odo.toLocaleString()})`
        nextTripId = round.id
        nextRole = 'TRIP_CLOSING'
        nextSource = 'FACTORY_TANK'
      } else {
        const result = autoRoute(vehicleId, editDraft.date, editDraft.source, liters, vehicles, dispatches, fuelStock, fuelRecords)
        nextStatus = result.status
        nextLabel = result.statusLabel
        nextTripId = result.tripId
        nextRole = 'NORMAL'
      }

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
            source: nextSource,
            tripId: nextTripId,
            status: nextStatus as FuelTransaction['status'],
            tripFuelRole: nextRole,
          },
        })
      }

      // Update FuelRecord (backward compat)
      if (row.fuelRecId) {
        await updateFuelRec.mutateAsync({
          id: row.fuelRecId,
          patch: {
            date: editDraft.date,
            vehicleId,
            liters,
            pricePerL,
            total,
            station: nextSource === 'FACTORY_TANK' ? 'ถังโรงงาน' : 'ปั๊มภายนอก',
            odometer: wantClosing ? Number(editDraft.odometer) : 0,
            ...(wantClosing && closingRound?.date ? { accountingDate: closingRound.date } : {}),
          },
        })
      }

      // Sync รอบ: เขียน endOdometer เมื่อเป็นปิดรอบ, เคลียร์เมื่อถูกลดเป็นน้ำมันปกติ
      if (wantClosing && closingRound) {
        await updateDispatch.mutateAsync({
          id: closingRound.id,
          patch: { endOdometer: Number(editDraft.odometer), closingFuelLiters: liters, closingFuelPrice: pricePerL },
        })
      } else if (!wantClosing && row.tripFuelRole === 'TRIP_CLOSING' && row.closingRoundId) {
        await updateDispatch.mutateAsync({
          id: row.closingRoundId,
          patch: { endOdometer: null, closingFuelLiters: null, closingFuelPrice: null },
        })
      }

      patchRow(i, {
        date: editDraft.date,
        plateTerm: editDraft.plateTerm,
        vehicleId,
        liters: editDraft.liters,
        pricePerL: editDraft.pricePerL,
        odometer: editDraft.odometer,
        source: nextSource,
        status: nextStatus,
        statusLabel: nextLabel,
        tripId: nextTripId,
        tripFuelRole: nextRole,
        closingRoundId: wantClosing ? (closingRound?.id ?? null) : null,
      })

      setEditingKey(null)
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // ── Reverse ──────────────────────────────────────────────────────────────────

  const confirmReverse = async (row: GridRow) => {
    try {
      // Mark FuelTransaction as REVERSED
      if (row.txId) {
        await updateFuelTx.mutateAsync({
          id: row.txId,
          patch: { status: 'REVERSED', reversedAt: new Date().toISOString() },
        })
      }

      // Remove FuelRecord so factory balance is restored
      if (row.fuelRecId) {
        try { await deleteFuelRec.mutateAsync(row.fuelRecId) } catch { /* already deleted */ }
      }

      // แถวปิดรอบเขียน endOdometer + น้ำมันปิดรอบลงรอบไว้ → ต้องเคลียร์ออก ไม่งั้น
      // รอบจะค้างเลขไมล์ปลายโดยไม่มีน้ำมันปิดรอบ ทำให้ KM/L ในหน้าปิดงานเพี้ยน
      if (row.tripFuelRole === 'TRIP_CLOSING' && row.closingRoundId) {
        try {
          await updateDispatch.mutateAsync({
            id: row.closingRoundId,
            patch: { endOdometer: null, closingFuelLiters: null, closingFuelPrice: null },
          })
        } catch { /* รอบอาจถูกปิด/ลบไปแล้ว */ }
      }

      setRows(prev => prev.map(r =>
        r.key === row.key
          ? { ...r, reversed: true, status: 'REVERSED', statusLabel: '🚫 ยกเลิกแล้ว' }
          : r,
      ))
      setReverseTarget(null)
    } catch (e) {
      alert('ยกเลิกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
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
            กด <kbd style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>Enter</kbd> เพื่อบันทึกแถวและขึ้นบรรทัดใหม่ · รองรับ Keyboard-only · กรอก <strong>เลขไมล์ปลายรอบ</strong> เพื่อปิดน้ำมัน+ไมล์เข้ารอบที่เปิดค้างพร้อมกัน
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
          {/* สลับแหล่งน้ำมันทั้งตารางทีเดียว — คีย์เร็วเมื่อทั้งชุดมาจากแหล่งเดียวกัน */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บันทึกทั้งหมดเป็น:</span>
            {(['FACTORY_TANK', 'EXTERNAL_PUMP'] as FuelSource[]).map(s => (
              <button
                key={s}
                onClick={() => applyGlobalSource(s)}
                title="ตั้งแหล่งน้ำมันให้ทุกแถวที่ยังไม่บันทึก (แถวปิดรอบยังเป็นคลังโรงงานเสมอ)"
                style={{
                  background: globalSource === s ? '#0066CC' : '#fff',
                  color: globalSource === s ? '#fff' : '#64748B',
                  border: '1px solid ' + (globalSource === s ? '#0066CC' : '#CBD5E1'),
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                }}
              >
                {s === 'FACTORY_TANK' ? '🏭 คลังโรงงาน' : '⛽ ปั๊มนอก'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRows(prev => [...prev, makeRow(globalSource)])}
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
                {(['#', 'วันที่', 'ทะเบียน', 'ลิตร', 'ราคา/ลิตร', 'เลขไมล์ปลายรอบ', 'แหล่งน้ำมัน', 'สถานะ', 'จัดการ']
                ).map((h, hi) => (
                  <th key={hi} style={{
                    padding: '9px 12px',
                    textAlign: hi === 0 ? 'center' : (hi === 3 || hi === 4 || hi === 5) ? 'right' : hi === 8 ? 'center' : 'left',
                    color: '#64748B', fontSize: 11, fontWeight: 700,
                    width: [40, 130, 155, 95, 110, 120, 165, undefined, 120][hi],
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
                          onChange={e => {
                            const d = e.target.value
                            // Auto-fill price only for factory tank — drivers type external-pump prices.
                            if (row.source === 'FACTORY_TANK') {
                              const auto = priceForDate(dailyPrices, 'FACTORY_TANK', d)
                              patchRow(i, auto != null ? { date: d, pricePerL: String(auto) } : { date: d })
                            } else {
                              patchRow(i, { date: d })
                            }
                          }}
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
                          autoComplete="off"
                          name={`plate-edit-${i}`}
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
                          autoComplete="off"
                          name={`plate-${i}`}
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

                    {/* ราคา/ลิตร — visible for everyone; auto-filled for FACTORY_TANK,
                        typed by the driver for EXTERNAL_PUMP (varies per station) */}
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

                    {/* เลขไมล์ปลายรอบ — กรอกเมื่อปิดรอบ (เติม+จดไมล์ที่โรงงานพร้อมกัน).
                        เว้นว่าง = น้ำมันปกติ; กรอก = ผูกเป็นน้ำมันปิดรอบของรอบ draft */}
                    <td style={{ padding: '5px 7px', verticalAlign: 'top' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editDraft.odometer}
                          onChange={e => setEditDraft(d => ({ ...d, odometer: e.target.value }))}
                          placeholder="ไมล์ปลาย"
                          style={{ ...cellInput, textAlign: 'right' }}
                        />
                      ) : (
                        <>
                          <input
                            id={`cell-${i}-4`}
                            type="number"
                            min="0"
                            step="1"
                            value={row.odometer}
                            disabled={locked || row.reversed}
                            onChange={e => patchRow(i, { odometer: e.target.value })}
                            onKeyDown={onKeyDown(i, false)}
                            placeholder="— (ปิดรอบ)"
                            style={{ ...cellInput, textAlign: 'right', border: '1px solid var(--line)', background: locked ? 'transparent' : '#fff', opacity: locked ? 0.55 : 1 }}
                          />
                          {!locked && closingHint(row)}
                        </>
                      )}
                    </td>

                    {/* แหล่ง — แถวปิดรอบ (มีเลขไมล์) ล็อกเป็นคลังโรงงานเสมอ */}
                    <td style={{ padding: '5px 7px', verticalAlign: 'top' }}>
                      {isEditing ? (
                        <select
                          value={editDraft.odometer.trim() !== '' ? 'FACTORY_TANK' : editDraft.source}
                          disabled={editDraft.odometer.trim() !== ''}
                          title={editDraft.odometer.trim() !== '' ? 'น้ำมันปิดรอบ = คลังโรงงานเสมอ' : undefined}
                          onChange={e => setEditDraft(d => ({ ...d, source: e.target.value as FuelSource }))}
                          style={cellInput}
                        >
                          <option value="FACTORY_TANK">🏭 ถังโรงงาน</option>
                          <option value="EXTERNAL_PUMP">⛽ ปั๊มนอก</option>
                        </select>
                      ) : (
                        <select
                          id={`cell-${i}-5`}
                          value={row.odometer.trim() !== '' ? 'FACTORY_TANK' : row.source}
                          disabled={locked || row.reversed || row.odometer.trim() !== ''}
                          title={row.odometer.trim() !== '' ? 'น้ำมันปิดรอบ = คลังโรงงานเสมอ' : undefined}
                          onChange={e => {
                            const s = e.target.value as FuelSource
                            // Swapping to factory tank → pull the daily price.
                            // Swapping back to external pump → clear, driver re-enters.
                            if (s === 'FACTORY_TANK') {
                              const auto = priceForDate(dailyPrices, 'FACTORY_TANK', row.date)
                              patchRow(i, auto != null ? { source: s, pricePerL: String(auto) } : { source: s })
                            } else {
                              patchRow(i, { source: s, pricePerL: '' })
                            }
                          }}
                          onKeyDown={onKeyDown(i, true)}
                          style={{ ...cellInput, cursor: (locked || row.reversed || row.odometer.trim() !== '') ? 'default' : 'pointer', border: '1px solid var(--line)', background: locked ? 'transparent' : '#fff', opacity: locked ? 0.55 : 1 }}
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
          <button className="btn" onClick={() => setRows([makeRow(globalSource)])} style={{ fontSize: 13 }}>
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
