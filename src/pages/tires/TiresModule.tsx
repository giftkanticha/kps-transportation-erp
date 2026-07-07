import { useState, useMemo, useEffect, useRef } from 'react'
import { db } from '../../lib/db'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { Icon } from '../../components/ui/Icon'
import { Field } from '../../components/ui/Field'
import { SearchInput } from '../../components/ui/SearchInput'
import { Info } from '../../components/ui/Info'
import { FontScaleControl } from '../../components/ui/FontScaleControl'
import { usePrint } from '../../hooks/usePrint'
import { useAuth } from '../../context/AuthContext'
import type { Tire, TireEvent, TireScrapSale, Vehicle } from '../../types'

// ── Thresholds ────────────────────────────────────────────────────
// Truck tires (10/18/22 ล้อ) — green up to 120k, amber 120k–150k, red 150k+.
// Earlier defaults were 40k / 50k which match passenger cars, not the fleet.
const KM_WARN_T = 120000
const KM_CRIT_T = 150000

const kmStatus = (km: number) => {
  if (km >= KM_CRIT_T) return { color: '#dc2626', bg: '#fee2e2', label: 'ใกล้หมด', dot: 'red' }
  if (km >= KM_WARN_T) return { color: '#d97706', bg: '#fef3c7', label: 'ปานกลาง', dot: 'amber' }
  return { color: '#16a34a', bg: '#dcfce7', label: 'ดี', dot: 'green' }
}

// Equipment (forklifts, loaders, grinders) shouldn't appear in the tire system.
function useFleetVehicles() {
  const { data = [] } = useList<Vehicle>('vehicles')
  return useMemo(() => data.filter((v) => v.groupKind !== 'EQUIPMENT'), [data])
}

const LOC_LABEL: Record<string, { label: string; cls: string }> = {
  'in-use': { label: 'ใช้งาน', cls: 'blue' },
  spare: { label: 'สำรอง', cls: 'gray' },
  stock: { label: 'คลัง', cls: 'violet' },
  sold: { label: 'ขาย', cls: 'red' },
  scrapped: { label: 'หมดสภาพ', cls: 'red' },
}

// Compute real accumulated km (in-use tires count live from vehicle odometer)
const computeAccumKm = (tire: Tire, vehicles: Vehicle[]): number => {
  if (tire.status === 'in-use' && tire.vehicleId) {
    const v = vehicles.find((vv) => vv.id === tire.vehicleId)
    if (v) return tire.accumulatedKm + Math.max(0, v.odometer - tire.installedOdometer)
  }
  return tire.accumulatedKm
}

const wcFrom = (type: string): number => {
  if (type.includes('22')) return 22
  if (type.includes('18')) return 18
  if (type.includes('10')) return 10
  if (type.includes('6')) return 6
  if (type.includes('4')) return 4
  return 10
}

// ── SVG Layouts (top-view: front = top, left side = left) ─────────
interface AxleLine { x1: number; y1: number; x2: number; y2: number }
interface WheelPos { pos: string; cx: number; cy: number; r: number }
interface TireLayout { h: number; axles: AxleLine[]; pos: WheelPos[] }

const TL: Record<number, TireLayout> = {
  4: {
    h: 300,
    axles: [
      { x1: 38, y1: 95, x2: 262, y2: 95 },
      { x1: 38, y1: 220, x2: 262, y2: 220 },
    ],
    pos: [
      { pos: 'P1', cx: 50, cy: 95, r: 22 },
      { pos: 'P2', cx: 250, cy: 95, r: 22 },
      { pos: 'P3', cx: 50, cy: 220, r: 22 },
      { pos: 'P4', cx: 250, cy: 220, r: 22 },
    ],
  },
  6: {
    h: 370,
    axles: [
      { x1: 38, y1: 90, x2: 262, y2: 90 },
      { x1: 26, y1: 268, x2: 274, y2: 268 },
    ],
    pos: [
      { pos: 'P1', cx: 50, cy: 90, r: 22 },
      { pos: 'P2', cx: 250, cy: 90, r: 22 },
      { pos: 'P3', cx: 42, cy: 268, r: 18 },
      { pos: 'P4', cx: 68, cy: 268, r: 18 },
      { pos: 'P5', cx: 232, cy: 268, r: 18 },
      { pos: 'P6', cx: 258, cy: 268, r: 18 },
    ],
  },
  10: {
    h: 455,
    axles: [
      { x1: 38, y1: 90, x2: 262, y2: 90 },
      { x1: 26, y1: 232, x2: 274, y2: 232 },
      { x1: 26, y1: 360, x2: 274, y2: 360 },
    ],
    pos: [
      { pos: 'P1', cx: 50, cy: 90, r: 22 },
      { pos: 'P2', cx: 250, cy: 90, r: 22 },
      { pos: 'P3', cx: 42, cy: 232, r: 18 },
      { pos: 'P4', cx: 68, cy: 232, r: 18 },
      { pos: 'P5', cx: 232, cy: 232, r: 18 },
      { pos: 'P6', cx: 258, cy: 232, r: 18 },
      { pos: 'P7', cx: 42, cy: 360, r: 18 },
      { pos: 'P8', cx: 68, cy: 360, r: 18 },
      { pos: 'P9', cx: 232, cy: 360, r: 18 },
      { pos: 'P10', cx: 258, cy: 360, r: 18 },
    ],
  },
  18: {
    h: 610,
    axles: [
      { x1: 38, y1: 83, x2: 262, y2: 83 },
      { x1: 26, y1: 190, x2: 274, y2: 190 },
      { x1: 26, y1: 297, x2: 274, y2: 297 },
      { x1: 26, y1: 404, x2: 274, y2: 404 },
      { x1: 26, y1: 511, x2: 274, y2: 511 },
    ],
    pos: [
      { pos: 'P1', cx: 50, cy: 83, r: 22 },
      { pos: 'P2', cx: 250, cy: 83, r: 22 },
      { pos: 'P3', cx: 40, cy: 190, r: 16 },
      { pos: 'P4', cx: 63, cy: 190, r: 16 },
      { pos: 'P5', cx: 237, cy: 190, r: 16 },
      { pos: 'P6', cx: 260, cy: 190, r: 16 },
      { pos: 'P7', cx: 40, cy: 297, r: 16 },
      { pos: 'P8', cx: 63, cy: 297, r: 16 },
      { pos: 'P9', cx: 237, cy: 297, r: 16 },
      { pos: 'P10', cx: 260, cy: 297, r: 16 },
      { pos: 'P11', cx: 40, cy: 404, r: 16 },
      { pos: 'P12', cx: 63, cy: 404, r: 16 },
      { pos: 'P13', cx: 237, cy: 404, r: 16 },
      { pos: 'P14', cx: 260, cy: 404, r: 16 },
      { pos: 'P15', cx: 40, cy: 511, r: 16 },
      { pos: 'P16', cx: 63, cy: 511, r: 16 },
      { pos: 'P17', cx: 237, cy: 511, r: 16 },
      { pos: 'P18', cx: 260, cy: 511, r: 16 },
    ],
  },
  22: {
    h: 710,
    axles: [
      { x1: 38, y1: 83, x2: 262, y2: 83 },
      { x1: 26, y1: 185, x2: 274, y2: 185 },
      { x1: 26, y1: 283, x2: 274, y2: 283 },
      { x1: 26, y1: 381, x2: 274, y2: 381 },
      { x1: 26, y1: 483, x2: 274, y2: 483 },
      { x1: 26, y1: 585, x2: 274, y2: 585 },
    ],
    pos: [
      { pos: 'P1', cx: 50, cy: 83, r: 22 },
      { pos: 'P2', cx: 250, cy: 83, r: 22 },
      { pos: 'P3', cx: 38, cy: 185, r: 14 },
      { pos: 'P4', cx: 59, cy: 185, r: 14 },
      { pos: 'P5', cx: 241, cy: 185, r: 14 },
      { pos: 'P6', cx: 262, cy: 185, r: 14 },
      { pos: 'P7', cx: 38, cy: 283, r: 14 },
      { pos: 'P8', cx: 59, cy: 283, r: 14 },
      { pos: 'P9', cx: 241, cy: 283, r: 14 },
      { pos: 'P10', cx: 262, cy: 283, r: 14 },
      { pos: 'P11', cx: 38, cy: 381, r: 14 },
      { pos: 'P12', cx: 59, cy: 381, r: 14 },
      { pos: 'P13', cx: 241, cy: 381, r: 14 },
      { pos: 'P14', cx: 262, cy: 381, r: 14 },
      { pos: 'P15', cx: 38, cy: 483, r: 14 },
      { pos: 'P16', cx: 59, cy: 483, r: 14 },
      { pos: 'P17', cx: 241, cy: 483, r: 14 },
      { pos: 'P18', cx: 262, cy: 483, r: 14 },
      { pos: 'P19', cx: 38, cy: 585, r: 14 },
      { pos: 'P20', cx: 59, cy: 585, r: 14 },
      { pos: 'P21', cx: 241, cy: 585, r: 14 },
      { pos: 'P22', cx: 262, cy: 585, r: 14 },
    ],
  },
}

// ── Pure SVG Tire Map ─────────────────────────────────────────────
interface TireMapSVGProps {
  wc: number
  tireMap: Record<string, Tire>
  selectedPos: string | null
  onSelect?: (pos: string, tire: Tire | undefined) => void
  selectable?: boolean
  showHoverTip?: boolean
}

function TireMapSVG({ wc, tireMap, selectedPos, onSelect, selectable, showHoverTip }: TireMapSVGProps) {
  const layout = TL[wc] ?? TL[10]
  const [hoverTip, setHoverTip] = useState<{ pos: string; tire: Tire | undefined; x: number; y: number; cw: number } | null>(null)
  return (
    <div style={{ position: 'relative' }}>
      {showHoverTip && hoverTip && (
        <div style={{
          position: 'absolute',
          left: Math.max(4, Math.min(hoverTip.x + 12, hoverTip.cw - 164)),
          top: Math.max(4, hoverTip.y - 10),
          zIndex: 50,
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0,0,0,.15)',
          fontSize: 12.5,
          pointerEvents: 'none',
          whiteSpace: 'normal',
          width: 150,
          maxWidth: 160,
        }}>
          {hoverTip.tire ? (
            <>
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{hoverTip.tire.serial}</div>
              <div style={{ color: 'var(--text-muted)' }}>{hoverTip.pos}</div>
              <div style={{ color: kmStatus(hoverTip.tire.accumulatedKm ?? 0).color, fontWeight: 600, marginTop: 4 }}>
                {db.fmt(hoverTip.tire.accumulatedKm ?? 0)} km สะสม
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>{hoverTip.pos}: ว่าง</div>
          )}
        </div>
      )}
      <svg
        width={300}
        height={layout.h}
        viewBox={`0 0 300 ${layout.h}`}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Truck outline */}
        <rect
          x={93}
          y={18}
          width={114}
          height={layout.h - 36}
          rx={8}
          fill="#f8fafc"
          stroke="#e2e8f0"
          strokeWidth={1.5}
        />
        <text
          x={150}
          y={12}
          textAnchor="middle"
          fontSize={9}
          fill="#94a3b8"
          fontFamily="system-ui"
        >
          ▲ หน้ารถ
        </text>
        {/* Axle lines */}
        {layout.axles.map((a, i) => (
          <line
            key={i}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke="#94a3b8"
            strokeWidth={2.5}
          />
        ))}
        {/* Tires */}
        {layout.pos.map((p) => {
          const t = tireMap[p.pos]
          const isSel = selectedPos === p.pos
          const km = t?.accumulatedKm ?? 0
          let fillC: string, strokeC: string
          if (isSel) {
            fillC = '#dbeafe'
            strokeC = '#2563eb'
          } else if (!t) {
            fillC = '#e2e8f0'
            strokeC = '#94a3b8'
          } else if (t.status === 'spare') {
            fillC = '#f8fafc'
            strokeC = '#94a3b8'
          } else if (km >= KM_CRIT_T) {
            fillC = '#fee2e2'
            strokeC = '#dc2626'
          } else if (km >= KM_WARN_T) {
            fillC = '#fef3c7'
            strokeC = '#d97706'
          } else {
            fillC = '#dcfce7'
            strokeC = '#16a34a'
          }
          return (
            <g
              key={p.pos}
              onClick={() => selectable && onSelect && onSelect(p.pos, t)}
              style={{ cursor: selectable ? 'pointer' : 'default' }}
              onMouseEnter={showHoverTip ? (e) => {
                const rect = (e.currentTarget.closest('svg')!.parentElement as HTMLElement).getBoundingClientRect()
                setHoverTip({ pos: p.pos, tire: t, x: e.clientX - rect.left, y: e.clientY - rect.top, cw: rect.width })
              } : undefined}
              onMouseLeave={showHoverTip ? () => setHoverTip(null) : undefined}
            >
              <circle
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                fill={fillC}
                stroke={strokeC}
                strokeWidth={isSel ? 3 : 2}
              />
              <circle
                cx={p.cx}
                cy={p.cy}
                r={p.r * 0.38}
                fill="none"
                stroke={strokeC}
                strokeWidth={1.2}
                opacity={0.55}
              />
              <text
                x={p.cx}
                y={p.cy + 4}
                textAnchor="middle"
                fontSize={p.r >= 20 ? 10 : p.r >= 16 ? 9 : 8}
                fill={isSel ? '#1d4ed8' : strokeC}
                fontWeight="700"
                fontFamily="system-ui"
              >
                {p.pos}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Tab 1: All Tires ─────────────────────────────────────────────

function InstallTireModal({ tire, onClose, onDone }: { tire: Tire; onClose: () => void; onDone: () => void }) {
  const { profile } = useAuth()
  const vehicles = useFleetVehicles()
  const { data: tires = [] } = useList<Tire>('tires')
  const updateTire = useUpdate<Tire>('tires')
  const insertEvent = useInsert<TireEvent>('tire_events')
  const [vehicleId, setVehicleId] = useState('')
  const [position, setPosition] = useState('')

  const vehicle = vehicles.find((v) => v.id === vehicleId)
  const wc = wcFrom(vehicle?.type ?? '')
  const layout = TL[wc] ?? TL[10]
  const allPos = layout.pos.map((p) => p.pos).concat(['spare_1', 'spare_2'])
  const occupied: Record<string, Tire> = {}
  tires
    .filter((t) => t.vehicleId === vehicleId && t.position && t.id !== tire.id)
    .forEach((t) => { occupied[t.position as string] = t })

  const confirm = async () => {
    if (!vehicleId) { alert('กรุณาเลือกรถ'); return }
    if (!position) { alert('กรุณาเลือกตำแหน่ง'); return }
    if (occupied[position]) { alert('ตำแหน่งนี้มียางอยู่แล้ว — เลือกตำแหน่งว่าง หรือใช้ "สลับยาง"'); return }
    try {
      const odo = vehicle?.odometer ?? 0
      const today = new Date().toISOString().slice(0, 10)
      // Installing into a spare slot keeps the tire as 'spare' so it doesn't
      // accrue km while parked on the rack.
      const status = position.startsWith('spare') ? 'spare' : 'in-use'
      await updateTire.mutateAsync({
        id: tire.id,
        patch: { status, vehicleId, position, installedDate: today, installedOdometer: odo },
      })
      await insertEvent.mutateAsync({
        tireId: tire.id, vehicleId, eventType: 'install', date: today,
        odometer: odo, fromPos: null, toPos: position, note: 'ติดตั้งจากคลัง', userId: profile?.id ?? 'e10',
      })
      onDone()
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: 480, maxWidth: '95vw', background: '#fff', borderRadius: 14 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ใส่ยางลงล้อ</h3>
          <button className="btn ghost icon sm" onClick={onClose} style={{ marginLeft: 'auto' }}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 14, background: 'var(--bg-sunk)', borderRadius: 10 }}>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{tire.serial}</span>
            <span className="muted" style={{ marginLeft: 8 }}>{tire.brand} {tire.model} · {tire.size}</span>
          </div>
          <Field label="เลือกรถ *">
            <select value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setPosition('') }}>
              <option value="">-- เลือกรถ --</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} ({v.type})</option>)}
            </select>
          </Field>
          <Field label="ตำแหน่ง *">
            <select value={position} onChange={(e) => setPosition(e.target.value)} disabled={!vehicleId}>
              <option value="">-- เลือกตำแหน่ง --</option>
              {allPos.map((p) => {
                const t = occupied[p]
                return <option key={p} value={p} disabled={!!t}>{p} {t ? `(มียาง ${t.serial})` : '(ว่าง)'}</option>
              })}
            </select>
          </Field>
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={confirm} disabled={!vehicleId || !position}>
            <Icon name="check" size={15} /> ยืนยันติดตั้ง
          </button>
        </div>
      </div>
    </div>
  )
}

function TireActionMenu({ tire, onRefresh }: { tire: Tire; onRefresh: () => void }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [modal, setModal] = useState<'history' | 'swap' | 'install' | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const vehicles = useFleetVehicles()
  const { data: allTires = [] } = useList<Tire>('tires')
  const updateTire = useUpdate<Tire>('tires')
  const insertEvent = useInsert<TireEvent>('tire_events')

  const vehicle = tire.vehicleId ? vehicles.find((v) => v.id === tire.vehicleId) : undefined
  const onVehicle = tire.status === 'in-use' && !!vehicle
  const canInstall = tire.status === 'stock' || tire.status === 'spare'

  const tireMap = useMemo(() => {
    const m: Record<string, Tire> = {}
    if (tire.vehicleId) {
      allTires
        .filter((t) => t.vehicleId === tire.vehicleId && t.position)
        .forEach((t) => { m[t.position as string] = t })
    }
    return m
  }, [allTires, tire.vehicleId])

  const markScrapped = async () => {
    const km = computeAccumKm(tire, vehicles)
    await updateTire.mutateAsync({
      id: tire.id,
      patch: {
        status: 'scrapped',
        vehicleId: null,
        position: null,
        accumulatedKm: km,
      },
    })
    await insertEvent.mutateAsync({
      tireId: tire.id, vehicleId: tire.vehicleId ?? '',
      eventType: 'scrap', date: new Date().toISOString().slice(0, 10),
      odometer: vehicle?.odometer ?? 0, fromPos: tire.position, toPos: null,
      note: 'หมดสภาพ', userId: profile?.id ?? 'e10',
    })
    setOpen(false)
    onRefresh()
  }

  const moveToStock = async () => {
    const km = computeAccumKm(tire, vehicles)
    await updateTire.mutateAsync({
      id: tire.id,
      patch: {
        status: 'stock',
        vehicleId: null,
        position: null,
        accumulatedKm: km,
      },
    })
    await insertEvent.mutateAsync({
      tireId: tire.id, vehicleId: tire.vehicleId ?? '',
      eventType: 'remove', date: new Date().toISOString().slice(0, 10),
      odometer: vehicle?.odometer ?? 0, fromPos: tire.position, toPos: null,
      note: 'ย้ายเข้าคลัง', userId: profile?.id ?? 'e10',
    })
    setOpen(false)
    onRefresh()
  }

  const actions: { icon: string; label: string; danger?: boolean; action: () => void }[] = [
    { icon: 'dashboard', label: 'ดูประวัติ', action: () => { setOpen(false); setModal('history') } },
    ...(onVehicle ? [{ icon: 'arrow-right', label: 'สลับยาง', action: () => { setOpen(false); setModal('swap') } }] : []),
    ...(onVehicle ? [{ icon: 'package', label: 'ถอดเข้าคลัง', action: moveToStock }] : []),
    ...(canInstall ? [{ icon: 'tire', label: 'ใส่ลงล้อ', action: () => { setOpen(false); setModal('install') } }] : []),
    { icon: 'trash', label: 'หมดสภาพ', danger: true, action: markScrapped },
  ]

  const MENU_W = 160
  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const menuH = actions.length * 38 + 12
      const openUp = r.bottom + menuH > window.innerHeight && r.top - menuH > 0
      setCoords({
        top: openUp ? r.top - menuH - 4 : r.bottom + 4,
        left: Math.max(8, r.right - MENU_W),
      })
    }
    setOpen(true)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className="btn ghost icon sm" onClick={toggle}>
        <Icon name="more" size={16} />
      </button>
      {open && coords && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1090 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 1100,
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,.15)',
              width: MENU_W,
              padding: 6,
            }}
          >
            {actions.map((a) => (
              <button
                key={a.label}
                className="btn ghost"
                onClick={a.action}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  gap: 8,
                  padding: '7px 12px',
                  color: a.danger ? 'var(--red)' : undefined,
                }}
              >
                <Icon name={a.icon} size={14} /> {a.label}
              </button>
            ))}
          </div>
        </>
      )}
      {modal === 'history' && (
        <TireHistoryModal tire={tire} onClose={() => setModal(null)} />
      )}
      {modal === 'swap' && vehicle && (
        <TireSwapModal
          tire={tire}
          vehicle={vehicle}
          tireMap={tireMap}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); onRefresh() }}
        />
      )}
      {modal === 'install' && (
        <InstallTireModal
          tire={tire}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); onRefresh() }}
        />
      )}
    </div>
  )
}

function TiresAll({ setActive }: { setActive: (id: string) => void }) {
  const { data: allTires = [] } = useList<Tire>('tires')

  const openHistory = (serial: string) => {
    sessionStorage.setItem('kps_tire_history_serial', serial)
    setActive('tires.history')
  }
  const { data: events = [] } = useList<TireEvent>('tire_events')
  const vehicles = useFleetVehicles()
  const brands = [...new Set(allTires.map((t) => t.brand))]

  const [q, setQ] = useState('')
  const [sfilt, setSfilt] = useState<Record<string, boolean>>({
    'in-use': true,
    spare: true,
    stock: true,
    sold: true,
  })
  const [vfilt, setVfilt] = useState('all')
  const [bfilt, setBfilt] = useState('all')

  const filtered = useMemo(
    () =>
      allTires.filter((t) => {
        if (
          q &&
          !t.serial.toLowerCase().includes(q.toLowerCase()) &&
          !t.brand.toLowerCase().includes(q.toLowerCase())
        )
          return false
        if (!sfilt[t.status]) return false
        if (vfilt !== 'all' && t.vehicleId !== vfilt) return false
        if (bfilt !== 'all' && t.brand !== bfilt) return false
        return true
      }),
    [allTires, q, sfilt, vfilt, bfilt],
  )

  const hasEvent = (tid: string) => events.some((e) => e.tireId === tid)

  const kpiCounts = useMemo(
    () => ({
      total: allTires.length,
      // Use the LIVE accumulated km (stored value + km driven since install) so
      // the wear buckets reflect reality — the stored accumulatedKm only updates
      // on swap/remove, so counting it directly left worn tires as "good".
      good: allTires.filter(
        (t) => t.status === 'in-use' && computeAccumKm(t, vehicles) < KM_WARN_T,
      ).length,
      warn: allTires.filter(
        (t) =>
          t.status === 'in-use' &&
          computeAccumKm(t, vehicles) >= KM_WARN_T &&
          computeAccumKm(t, vehicles) < KM_CRIT_T,
      ).length,
      crit: allTires.filter(
        (t) => t.status === 'in-use' && computeAccumKm(t, vehicles) >= KM_CRIT_T,
      ).length,
    }),
    [allTires, vehicles],
  )

  return (
    <div>
      {/* KPI */}
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="card kpi">
          <div className="label">ยางทั้งหมด</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
            {kpiCounts.total} <span style={{ fontSize: 13, fontWeight: 400 }}>เส้น</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="row" style={{ gap: 8 }}>
            <div className="icn-box green">
              <Icon name="check" size={16} />
            </div>
            <div className="label">สภาพดี (ใช้งาน)</div>
          </div>
          <div
            className="mono"
            style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--green)' }}
          >
            {kpiCounts.good}
          </div>
        </div>
        <div className="card kpi">
          <div className="row" style={{ gap: 8 }}>
            <div className="icn-box amber">
              <Icon name="alert" size={16} />
            </div>
            <div className="label">ปานกลาง</div>
          </div>
          <div
            className="mono"
            style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--amber)' }}
          >
            {kpiCounts.warn}
          </div>
        </div>
        <div className="card kpi">
          <div className="row" style={{ gap: 8 }}>
            <div className="icn-box red">
              <Icon name="alert" size={16} />
            </div>
            <div className="label">ใกล้หมด / วิกฤติ</div>
          </div>
          <div
            className="mono"
            style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--red)' }}
          >
            {kpiCounts.crit}
          </div>
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div className="row" style={{ gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <SearchInput value={q} onChange={setQ} placeholder="ค้นหา เลขซีเรียล / ยี่ห้อ" />
            {/* Status checkboxes */}
            <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
              <span
                className="muted"
                style={{ fontWeight: 600, fontSize: 13, marginRight: 6 }}
              >
                สถานะ:
              </span>
              {Object.entries(LOC_LABEL).map(([k, { label }]) => (
                <label
                  key={k}
                  className="row"
                  style={{
                    gap: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '4px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 20,
                    background: sfilt[k] ? 'var(--primary-50)' : 'var(--bg)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!sfilt[k]}
                    onChange={() => setSfilt((s) => ({ ...s, [k]: !s[k] }))}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <Field label="รถ">
              <select
                value={vfilt}
                onChange={(e) => setVfilt(e.target.value)}
                style={{ width: 160, height: 38 }}
              >
                <option value="all">ทั้งหมด</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ยี่ห้อ">
              <select
                value={bfilt}
                onChange={(e) => setBfilt(e.target.value)}
                style={{ width: 140, height: 38 }}
              >
                <option value="all">ทั้งหมด</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Table */}
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>เลขซีเรียล</th>
                <th>ยี่ห้อ</th>
                <th>รุ่น</th>
                <th>ขนาด</th>
                <th>สถานะ</th>
                <th>รถ</th>
                <th>ล้อ</th>
                <th className="right">Km สะสม</th>
                <th className="center">บันทึก</th>
                <th>ดำเนิน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const v = vehicles.find((vv) => vv.id === t.vehicleId)
                const km = computeAccumKm(t, vehicles)
                const ks = kmStatus(km)
                const isActive = t.status === 'in-use'
                const posLabel = t.position
                  ? t.position.startsWith('spare')
                    ? 'S' + t.position.slice(-1)
                    : t.position
                  : '—'
                return (
                  <tr key={t.id}>
                    <td>
                      <button
                        type="button"
                        className="mono"
                        onClick={() => openHistory(t.serial)}
                        title="ดูประวัติยางเส้นนี้"
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontWeight: 700, color: 'var(--primary)',
                          fontFamily: 'var(--font-mono)', fontSize: 'inherit',
                          cursor: 'pointer', textDecoration: 'none',
                        }}
                      >
                        {t.serial}
                      </button>
                    </td>
                    <td style={{ fontWeight: 500 }}>{t.brand}</td>
                    <td className="muted">{t.model}</td>
                    <td className="mono muted">{t.size}</td>
                    <td>
                      {isActive ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 10px',
                            borderRadius: 20,
                            background: ks.bg,
                            color: ks.color,
                            fontWeight: 600,
                            fontSize: 12.5,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: ks.color,
                              flexShrink: 0,
                            }}
                          />
                          {ks.label}
                        </span>
                      ) : (
                        <span className={`badge ${LOC_LABEL[t.status]?.cls ?? 'gray'}`}>
                          {LOC_LABEL[t.status]?.label ?? t.status}
                        </span>
                      )}
                    </td>
                    <td>
                      {v ? (
                        <a
                          style={{ color: 'var(--primary)', fontWeight: 600 }}
                          className="mono"
                        >
                          {v.plate}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge gray">{posLabel}</span>
                    </td>
                    <td className="num right mono">
                      {isActive ? (
                        <span style={{ color: ks.color, fontWeight: 600 }}>{db.fmt(km)}</span>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="center">
                      {hasEvent(t.id) ? (
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <TireActionMenu tire={t} onRefresh={() => {}} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--line)',
            color: 'var(--text-muted)',
            fontSize: 12.5,
          }}
        >
          แสดง {filtered.length} จากทั้งหมด {allTires.length} รายการ
        </div>
      </div>
    </div>
  )
}

// ── Add Tire Modal ────────────────────────────────────────────────
function AddTireModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const { data: tires = [] } = useList<Tire>('tires')
  const vehicles = useFleetVehicles()
  const insertTire = useInsert<Tire>('tires')
  const insertEvent = useInsert<TireEvent>('tire_events')
  const nextSerial = 'TIR' + String(
    // Use max(TIR####) + 1 so deleted tires don't leave a hole that collides.
    tires.reduce((max, t) => {
      const m = /^TIR(\d+)$/.exec(t.serial ?? '')
      return m ? Math.max(max, parseInt(m[1], 10)) : max
    }, 0) + 1,
  ).padStart(4, '0')
  const [form, setForm] = useState({
    serial: nextSerial,
    brand: 'Bridgestone',
    customBrand: '',
    model: 'T001',
    size: '11.00R20',
    status: 'in-use',
    vehicleId: '',
    position: 'P1',
    installedDate: new Date().toISOString().slice(0, 10),
    installedOdometer: '',
    accumulatedKm: 0,
  })
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))
  const wc = wcFrom(vehicles.find((v) => v.id === form.vehicleId)?.type ?? '')
  const layout = TL[wc] ?? TL[10]
  const allPos = layout.pos.map((p) => p.pos).concat(['spare_1', 'spare_2'])

  const save = async () => {
    if (!form.serial || !form.brand) {
      alert('กรุณากรอกเลขซีเรียลและยี่ห้อ')
      return
    }
    if (form.status === 'in-use' && !form.vehicleId) {
      alert('กรุณาเลือกรถที่จะติดตั้งยาง')
      return
    }
    try {
      const finalVehicleId = (form.status === 'in-use' || form.status === 'spare') ? (form.vehicleId || null) : null
      const finalPosition = form.status === 'in-use' ? (form.position || null) : null
      const newTire = await insertTire.mutateAsync({
        serial: form.serial,
        brand: form.brand === 'อื่นๆ' ? (form.customBrand.trim() || 'อื่นๆ') : form.brand,
        model: form.model,
        size: form.size,
        installedDate: form.installedDate,
        installedOdometer: +(form.installedOdometer) || 0,
        accumulatedKm: 0,
        status: form.status as Tire['status'],
        vehicleId: finalVehicleId,
        position: finalPosition,
      })
      if (form.status === 'in-use' && finalVehicleId) {
        await insertEvent.mutateAsync({
          tireId: newTire.id,
          vehicleId: finalVehicleId,
          eventType: 'install',
          date: form.installedDate,
          odometer: +(form.installedOdometer) || 0,
          fromPos: null,
          toPos: finalPosition,
          note: 'ยางใหม่',
          userId: profile?.id ?? 'e10',
        })
      }
      alert('เพิ่มยางเรียบร้อย')
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
        style={{ width: 600, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          className="row"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>เพิ่มยางใหม่</h3>
          <button className="btn ghost icon sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 22 }} className="col">
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="เลขซีเรียล *">
              <input value={form.serial} onChange={(e) => set('serial', e.target.value)} />
            </Field>
            <Field label="ยี่ห้อ *">
              <select value={form.brand} onChange={(e) => set('brand', e.target.value)}>
                <option>Bridgestone</option>
                <option>Michelin</option>
                <option>Goodyear</option>
                <option>Dunlop</option>
                <option>Yokohama</option>
                <option>Continental</option>
                <option value="อื่นๆ">อื่นๆ (พิมพ์เอง)</option>
              </select>
            </Field>
            {form.brand === 'อื่นๆ' && (
              <Field label="ระบุยี่ห้อ *">
                <input
                  value={form.customBrand}
                  onChange={(e) => set('customBrand', e.target.value)}
                  placeholder="เช่น Triangle, Double Coin"
                />
              </Field>
            )}
            <Field label="รุ่น">
              <input value={form.model} onChange={(e) => set('model', e.target.value)} />
            </Field>
            <Field label="ขนาด">
              <select value={form.size} onChange={(e) => set('size', e.target.value)}>
                <option value="">-- ไม่ระบุ --</option>
                {[
                  '11.00R20',
                  '11R22.5',
                  '12.00R24',
                  '10.00R20',
                  '295/80R22.5',
                  '315/80R22.5',
                  '265/65R17',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>สถานะเริ่มต้น</div>
            <div className="row" style={{ gap: 14 }}>
              {Object.entries(LOC_LABEL)
                .filter(([k]) => k !== 'sold')
                .map(([k, { label }]) => (
                  <label
                    key={k}
                    className="row"
                    style={{
                      gap: 6,
                      cursor: 'pointer',
                      padding: '8px 14px',
                      border: `2px solid ${form.status === k ? 'var(--primary)' : 'var(--line)'}`,
                      borderRadius: 10,
                      fontSize: 13.5,
                      fontWeight: form.status === k ? 600 : 400,
                    }}
                  >
                    <input
                      type="radio"
                      checked={form.status === k}
                      onChange={() => set('status', k)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    {label}
                  </label>
                ))}
            </div>
          </div>

          {(form.status === 'in-use' || form.status === 'spare') && (
            <div className="grid-2" style={{ gap: 14, marginTop: 16 }}>
              <Field label="เลือกรถ *">
                <select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
                  <option value="">-- เลือกรถ --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} ({v.type})
                    </option>
                  ))}
                </select>
              </Field>
              {form.status === 'in-use' && (
                <Field label="ตำแหน่งล้อ *">
                  <select value={form.position} onChange={(e) => set('position', e.target.value)}>
                    {allPos.map((p) => (
                      <option key={p} value={p}>
                        {p.startsWith('spare') ? 'ยางสำรอง' : 'ล้อ'} {p}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}

          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label="วันที่ซื้อ / ติดตั้ง">
              <input
                type="date"
                value={form.installedDate}
                onChange={(e) => set('installedDate', e.target.value)}
              />
            </Field>
            {form.status === 'in-use' && (
              <Field label="เลขไมล์รถตอนติดตั้ง">
                <input
                  type="number"
                  value={form.installedOdometer}
                  onChange={(e) => set('installedOdometer', e.target.value)}
                  placeholder="0"
                />
              </Field>
            )}
          </div>
        </div>
        <div
          className="row"
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--line)',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button className="btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn primary" onClick={save}>
            บันทึกยางใหม่
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: Layout ─────────────────────────────────────────────────
function TiresLayout() {
  const vehicles = useFleetVehicles()
  const { data: tires = [] } = useList<Tire>('tires')
  const [picked, setPicked] = useState('')
  const [popup, setPopup] = useState<{ pos: string; tire: Tire | undefined } | null>(null)
  const [historyTire, setHistoryTire] = useState<Tire | null>(null)
  const [swapTire, setSwapTire] = useState<Tire | null>(null)
  const { print } = usePrint()
  const refresh = () => { setPopup(null) }

  const effectivePicked = picked || vehicles[0]?.id || ''
  const v = vehicles.find((vv) => vv.id === effectivePicked)
  const wc = wcFrom(v?.type ?? '')
  const allTires = useMemo(() => tires.filter((t) => t.vehicleId === effectivePicked), [tires, effectivePicked])
  const tireMap: Record<string, Tire> = {}
  allTires.forEach((t) => {
    if (t.position) tireMap[t.position] = t
  })
  const spares = allTires.filter((t) => t.position?.startsWith('spare'))

  return (
    <div>
      {/* Vehicle picker */}
      <div className="card pad no-print" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="เลือกรถ">
            <select
              value={effectivePicked}
              onChange={(e) => {
                setPicked(e.target.value)
                setPopup(null)
              }}
              style={{ width: 320, height: 42, fontSize: 14 }}
            >
              {vehicles.map((vv) => (
                <option key={vv.id} value={vv.id}>
                  {vv.plate} ({vv.type})
                </option>
              ))}
            </select>
          </Field>
          {v && (
            <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
              <span className="mono" style={{ fontWeight: 600 }}>
                {v.plate}
              </span>
              <span className="muted" style={{ marginLeft: 10 }}>
                {v.type} · {wc} ล้อ
              </span>
              <span className="muted" style={{ marginLeft: 10 }}>
                เลขไมล์: <span className="mono">{db.fmt(v.odometer)} km</span>
              </span>
            </div>
          )}
          <div className="row" style={{ marginLeft: 'auto', gap: 8, alignItems: 'center' }}>
            <FontScaleControl />
            <button className="btn primary" onClick={() => print('landscape')} disabled={!v}>
              <Icon name="download" size={14} /> พิมพ์ผังยาง (A4 แนวนอน)
            </button>
          </div>
        </div>
      </div>

      {/* Print-only layout (2-column landscape A4) */}
      {v && (
        <TireLayoutPrintView
          vehicle={v}
          wc={wc}
          tireMap={tireMap}
          allTires={allTires}
          spares={spares}
        />
      )}

      {v && (
        <div
          className="no-print"
          style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: 18,
            alignItems: 'start',
          }}
        >
          {/* SVG Map */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
              ผังยาง {wc} ล้อ
            </div>
            <TireMapSVG
              key={`${effectivePicked}-${wc}`}
              wc={wc}
              tireMap={tireMap}
              selectedPos={popup?.pos ?? null}
              onSelect={(pos, t) => setPopup({ pos, tire: t })}
              selectable={true}
              showHoverTip={true}
            />

            {/* Spare tires */}
            {spares.length > 0 && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  background: 'var(--bg-sunk)',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    marginBottom: 10,
                    color: 'var(--text-muted)',
                  }}
                >
                  ยางสำรอง (ไม่สะสม km)
                </div>
                {spares.map((t, i) => (
                  <div
                    key={t.id}
                    className="row"
                    style={{
                      gap: 8,
                      padding: '8px 0',
                      borderTop: i > 0 ? '1px solid var(--line)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => setPopup({ pos: t.position!, tire: t })}
                  >
                    <svg width="28" height="28" viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r="13" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
                      <circle cx="14" cy="14" r="5" fill="#94a3b8" opacity=".5" />
                    </svg>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.serial}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {t.brand} {t.model}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="col" style={{ marginTop: 16, gap: 6, fontSize: 12.5 }}>
              {(
                [
                  ['#16a34a', '#dcfce7', 'ดี (< 120,000 km)'],
                  ['#d97706', '#fef3c7', 'ปานกลาง (120k-150k km)'],
                  ['#dc2626', '#fee2e2', 'ใกล้หมด (> 150,000 km)'],
                  ['#94a3b8', '#f8fafc', 'สำรอง / ว่าง'],
                ] as [string, string, string][]
              ).map(([c, bg, label]) => (
                <div key={label} className="row" style={{ gap: 8 }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: bg,
                      border: `2px solid ${c}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--text-2)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div>
            {popup ? (
              <div className="card" style={{ padding: 22 }}>
                <div className="row" style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {popup.pos.startsWith('spare') ? 'ยางสำรอง' : 'ตำแหน่ง ' + popup.pos}
                  </h3>
                  <button className="btn ghost icon sm" onClick={() => setPopup(null)}>
                    <Icon name="close" size={15} />
                  </button>
                </div>
                {popup.tire ? (
                  <div className="col" style={{ gap: 12 }}>
                    {(
                      [
                        [
                          'Serial',
                          <span
                            className="mono"
                            style={{ fontWeight: 700, color: 'var(--primary)' }}
                          >
                            {popup.tire.serial}
                          </span>,
                        ],
                        ['Brand/Model', `${popup.tire.brand} ${popup.tire.model}`],
                        ['ขนาด', popup.tire.size],
                        [
                          'Km สะสม',
                          <span
                            style={{
                              color: kmStatus(popup.tire.accumulatedKm ?? 0).color,
                              fontWeight: 700,
                            }}
                          >
                            {db.fmt(popup.tire.accumulatedKm ?? 0)} km
                          </span>,
                        ],
                        ['ติดตั้งเมื่อ', db.thaiDate(popup.tire.installedDate)],
                        [
                          'เลขไมล์ตอนติดตั้ง',
                          <span className="mono">
                            {db.fmt(popup.tire.installedOdometer ?? 0)} km
                          </span>,
                        ],
                      ] as [string, React.ReactNode][]
                    ).map(([l, val]) => (
                      <div key={l} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 150,
                            color: 'var(--text-muted)',
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {l}
                        </div>
                        <div style={{ fontSize: 13.5 }}>{val}</div>
                      </div>
                    ))}
                    {popup.tire.status === 'in-use' && (() => {
                      const s = kmStatus(popup.tire!.accumulatedKm ?? 0)
                      return (
                        <div
                          style={{
                            padding: '12px 16px',
                            background: s.bg,
                            borderRadius: 10,
                            marginTop: 4,
                          }}
                        >
                          <span style={{ color: s.color, fontWeight: 700 }}>
                            สภาพยาง: {s.label}
                          </span>
                        </div>
                      )
                    })()}
                    <div className="row" style={{ marginTop: 8, gap: 8 }}>
                      <button className="btn outline sm" onClick={() => setHistoryTire(popup.tire!)}>
                        <Icon name="dashboard" size={13} /> ดูประวัติ
                      </button>
                      <button className="btn primary sm" onClick={() => setSwapTire(popup.tire!)}>
                        <Icon name="arrow-right" size={13} /> สลับยาง
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="muted"
                    style={{ padding: 20, textAlign: 'center', fontSize: 13 }}
                  >
                    ไม่มียางในตำแหน่งนี้
                  </div>
                )}
              </div>
            ) : (
              <div
                className="card pad"
                style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}
              >
                <Icon name="tire" size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <div>คลิกที่ล้อในผังเพื่อดูรายละเอียด</div>
              </div>
            )}
          </div>
        </div>
      )}

      {historyTire && (
        <TireHistoryModal tire={historyTire} onClose={() => setHistoryTire(null)} />
      )}
      {swapTire && v && (
        <TireSwapModal
          tire={swapTire}
          vehicle={v}
          tireMap={tireMap}
          onClose={() => setSwapTire(null)}
          onDone={() => { setSwapTire(null); refresh() }}
        />
      )}
    </div>
  )
}

// ── Tire Layout Print View (A4 landscape, 2-column) ────────────
function TireLayoutPrintView({ vehicle, wc, tireMap, allTires, spares }: {
  vehicle: Vehicle
  wc: number
  tireMap: Record<string, Tire>
  allTires: Tire[]
  spares: Tire[]
}) {
  const layout = TL[wc] ?? TL[10]
  const today = new Date()
  const printDate = today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  // Sort: in-use by position number, then spares
  const sorted = [...allTires].sort((a, b) => {
    const pa = a.position ?? ''
    const pb = b.position ?? ''
    if (pa.startsWith('spare') && !pb.startsWith('spare')) return 1
    if (!pa.startsWith('spare') && pb.startsWith('spare')) return -1
    const na = parseInt(pa.replace(/\D/g, ''), 10) || 0
    const nb = parseInt(pb.replace(/\D/g, ''), 10) || 0
    return na - nb
  })

  return (
    <div className="print-only tire-layout-print">
      <div className="kps-print-header">
        <p className="co">KPS Transportations</p>
        <p className="ttl">ผังยาง · ทะเบียน {vehicle.plate} ({vehicle.type})</p>
        <p className="sub">{vehicle.brand} · {wc} ล้อ · เลขไมล์ ณ วันพิมพ์: {db.fmt(vehicle.odometer)} km</p>
        <p className="ts">พิมพ์เมื่อ {printDate}</p>
      </div>

      <div className="tire-print-grid">
        {/* LEFT: SVG layout with prominent numbers + accumulated km */}
        <div className="tire-print-left">
          <div className="tire-print-section-title">ผังตำแหน่งล้อ</div>
          <svg
            width="100%"
            viewBox={`0 0 300 ${layout.h}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ maxHeight: '170mm' }}
          >
            <rect x={93} y={18} width={114} height={layout.h - 36} rx={8} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.5} />
            <text x={150} y={12} textAnchor="middle" fontSize={10} fill="#475569" fontFamily="system-ui">▲ หน้ารถ</text>
            {layout.axles.map((a, i) => (
              <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#64748b" strokeWidth={2.5} />
            ))}
            {layout.pos.map(p => {
              const t = tireMap[p.pos]
              const km = t?.accumulatedKm ?? 0
              const ks = t ? kmStatus(km) : { color: '#94a3b8', bg: '#f1f5f9', label: '' }
              // Compact km label: 47320 → "47k", 0 → "—"
              const compactKm = km >= 1000 ? `${Math.round(km / 1000)}k` : km > 0 ? String(km) : ''
              return (
                <g key={p.pos}>
                  <circle cx={p.cx} cy={p.cy} r={p.r} fill={t ? ks.bg : '#f8fafc'} stroke={ks.color} strokeWidth={2.2} />
                  <text x={p.cx} y={p.cy - 1} textAnchor="middle" fontSize={p.r >= 20 ? 10 : 9} fontWeight={800} fill={ks.color} fontFamily="system-ui">{p.pos}</text>
                  {t && compactKm && (
                    <text x={p.cx} y={p.cy + p.r * 0.55} textAnchor="middle" fontSize={p.r >= 20 ? 8 : 7} fontWeight={600} fill={ks.color} fontFamily="system-ui">
                      {compactKm}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
          {spares.length > 0 && (
            <div className="tire-print-spares">
              <div className="tire-print-section-title" style={{ fontSize: '8pt', marginTop: '6mm' }}>ยางสำรอง</div>
              {spares.map(t => (
                <div key={t.id} style={{ fontSize: '7.5pt', marginTop: 2 }}>
                  • <strong>{t.serial}</strong> ({t.brand} {t.model})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: detail table */}
        <div className="tire-print-right">
          <div className="tire-print-section-title">ตารางรายละเอียดยาง ({sorted.length} เส้น)</div>
          <table className="tire-print-tbl">
            <thead>
              <tr>
                <th style={{ width: '11%' }}>ตำแหน่ง</th>
                <th style={{ width: '24%' }}>เลขซีเรียล</th>
                <th style={{ width: '15%' }}>วันที่ใส่</th>
                <th style={{ width: '15%' }}>ไมล์เริ่มต้น</th>
                <th style={{ width: '15%' }}>Km สะสม</th>
                <th style={{ width: '20%' }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 12 }}>ไม่มีข้อมูลยาง</td></tr>
              ) : sorted.map(t => {
                const km = t.accumulatedKm ?? 0
                const ks = kmStatus(km)
                return (
                  <tr key={t.id}>
                    <td><strong>{t.position ?? '—'}</strong></td>
                    <td><strong>{t.serial}</strong> <span style={{ color: '#64748b' }}>({t.brand})</span></td>
                    <td>{t.installedDate ? db.thaiDate(t.installedDate) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{db.fmt(t.installedOdometer ?? 0)}</td>
                    <td style={{ textAlign: 'right', color: ks.color, fontWeight: 700 }}>{db.fmt(km)}</td>
                    <td style={{ fontSize: '7.5pt' }}>{t.size}</td>
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

// ── Tire History Modal ──────────────────────────────────────────
function TireHistoryModal({ tire, onClose }: { tire: Tire; onClose: () => void }) {
  const vehicles = useFleetVehicles()
  const { data: allEvents = [] } = useList<TireEvent>('tire_events')
  const vehicle = tire.vehicleId ? vehicles.find((v) => v.id === tire.vehicleId) : null
  const events = useMemo(
    () => allEvents
      .filter(e => e.tireId === tire.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [allEvents, tire.id],
  )
  const EVT: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    install: { label: 'ติดตั้งใหม่', icon: '🛒', color: '#16a34a', bg: '#dcfce7' },
    swap: { label: 'สลับตำแหน่ง', icon: '↔', color: '#2563eb', bg: '#dbeafe' },
    remove: { label: 'ถอด/ปะ', icon: '🔧', color: '#d97706', bg: '#fef3c7' },
    scrap: { label: 'หมดสภาพ', icon: '⚠', color: '#dc2626', bg: '#fee2e2' },
    sell: { label: 'ขาย', icon: '💰', color: '#7c3aed', bg: '#ede9fe' },
  }
  const km = tire.accumulatedKm ?? 0
  const ks = kmStatus(km)
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 620, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="row" style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ประวัติยาง · <span className="mono" style={{ color: 'var(--primary)' }}>{tire.serial}</span></h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {tire.brand} {tire.model} · {tire.size}
            </div>
          </div>
          <button className="btn ghost icon sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: 22, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            <div style={{ padding: 12, background: 'var(--bg-sunk)', borderRadius: 10 }}>
              <div className="muted" style={{ fontSize: 11 }}>รถปัจจุบัน</div>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>{vehicle?.plate ?? '—'}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-sunk)', borderRadius: 10 }}>
              <div className="muted" style={{ fontSize: 11 }}>ตำแหน่ง</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{tire.position ?? '—'}</div>
            </div>
            <div style={{ padding: 12, background: ks.bg, borderRadius: 10 }}>
              <div className="muted" style={{ fontSize: 11 }}>Km สะสม</div>
              <div className="mono" style={{ fontWeight: 700, color: ks.color, marginTop: 2 }}>{db.fmt(km)} km</div>
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>
            Timeline ({events.length} เหตุการณ์)
          </div>
          {events.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>ยังไม่มีเหตุการณ์ที่บันทึก</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map(ev => {
                const cfg = EVT[ev.eventType] ?? { label: ev.eventType, icon: '•', color: '#64748b', bg: '#f1f5f9' }
                return (
                  <div key={ev.id} style={{ display: 'flex', gap: 12, padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: cfg.bg, fontSize: 16, flexShrink: 0,
                    }}>{cfg.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <strong style={{ color: cfg.color, fontSize: 13.5 }}>{cfg.label}</strong>
                        <span className="muted" style={{ fontSize: 11.5 }}>{db.thaiDate(ev.date)}</span>
                        {ev.odometer ? (
                          <span className="mono muted" style={{ fontSize: 11 }}>· {db.fmt(ev.odometer)} km</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--text-2)' }}>
                        {ev.fromPos && ev.toPos ? <>ย้าย <strong>{ev.fromPos}</strong> → <strong>{ev.toPos}</strong></>
                          : ev.toPos ? <>ตำแหน่ง <strong>{ev.toPos}</strong></>
                          : ev.fromPos ? <>ออกจาก <strong>{ev.fromPos}</strong></>
                          : null}
                        {ev.note && <span className="muted"> · {ev.note}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  )
}

// ── Tire Swap Modal ─────────────────────────────────────────────
function TireSwapModal({ tire, vehicle, tireMap, onClose, onDone }: {
  tire: Tire
  vehicle: Vehicle
  tireMap: Record<string, Tire>
  onClose: () => void
  onDone: () => void
}) {
  const { profile } = useAuth()
  const allVehicles = useFleetVehicles()
  const updateTire = useUpdate<Tire>('tires')
  const insertEvent = useInsert<TireEvent>('tire_events')
  const wc = wcFrom(vehicle.type ?? '')
  const layout = TL[wc] ?? TL[10]
  const allPos = layout.pos.map(p => p.pos).concat(['spare_1', 'spare_2'])
  const fromPos = tire.position ?? ''
  const [toPos, setToPos] = useState('')
  const [note, setNote] = useState('')
  const toTire = toPos ? tireMap[toPos] : undefined

  const confirm = async () => {
    if (!toPos || toPos === fromPos) return
    try {
      const odometer = vehicle.odometer ?? 0
      const today = new Date().toISOString().slice(0, 10)
      // A tire sitting in a spare slot must be status 'spare' so it stops
      // accumulating km (computeAccumKm only counts 'in-use'); moving back onto a
      // wheel position flips it to 'in-use'.
      const isSpare = (p: string) => p.startsWith('spare')
      const km1 = computeAccumKm(tire, allVehicles)
      await updateTire.mutateAsync({
        id: tire.id,
        patch: { position: toPos, accumulatedKm: km1, installedOdometer: odometer, status: isSpare(toPos) ? 'spare' : 'in-use' },
      })
      if (toTire) {
        const km2 = computeAccumKm(toTire, allVehicles)
        await updateTire.mutateAsync({
          id: toTire.id,
          patch: { position: fromPos, accumulatedKm: km2, installedOdometer: odometer, status: isSpare(fromPos) ? 'spare' : 'in-use' },
        })
      }
      await insertEvent.mutateAsync({
        tireId: tire.id,
        vehicleId: vehicle.id,
        eventType: 'swap',
        date: today,
        odometer,
        fromPos,
        toPos,
        note: note.trim() || (toTire ? `สลับกับ ${toTire.serial}` : 'ย้ายไปตำแหน่งว่าง'),
        userId: profile?.id ?? 'e10',
      })
      // Record the counterpart tire's move too, so its own timeline is accurate.
      if (toTire) {
        await insertEvent.mutateAsync({
          tireId: toTire.id,
          vehicleId: vehicle.id,
          eventType: 'swap',
          date: today,
          odometer,
          fromPos: toPos,
          toPos: fromPos,
          note: note.trim() || `สลับกับ ${tire.serial}`,
          userId: profile?.id ?? 'e10',
        })
      }
      onDone()
    } catch (e) {
      alert('สลับยางไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 520, maxWidth: '95vw', background: '#fff', borderRadius: 14 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="row" style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>สลับยาง · {vehicle.plate}</h3>
          <button className="btn ghost icon sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 14, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10 }}>
            <div className="muted" style={{ fontSize: 11 }}>ยางที่กำลังสลับ (ต้นทาง)</div>
            <div style={{ marginTop: 4 }}>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{tire.serial}</span>
              <span className="muted" style={{ marginLeft: 8 }}>{tire.brand} {tire.model}</span>
              <span className="badge gray" style={{ marginLeft: 8 }}>{fromPos || '—'}</span>
            </div>
          </div>

          <Field label="ตำแหน่งปลายทาง *">
            <select value={toPos} onChange={e => setToPos(e.target.value)}>
              <option value="">— เลือกตำแหน่ง —</option>
              {allPos.filter(p => p !== fromPos).map(p => {
                const t = tireMap[p]
                return (
                  <option key={p} value={p}>
                    {p} {t ? `(มียาง ${t.serial} — จะสลับกัน)` : '(ว่าง)'}
                  </option>
                )
              })}
            </select>
          </Field>

          {toTire && (
            <div style={{ padding: 14, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10 }}>
              <div className="muted" style={{ fontSize: 11 }}>จะถูกสลับกับ</div>
              <div style={{ marginTop: 4 }}>
                <span className="mono" style={{ fontWeight: 700, color: '#92400E' }}>{toTire.serial}</span>
                <span className="muted" style={{ marginLeft: 8 }}>{toTire.brand} {toTire.model}</span>
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                ยางนี้จะย้ายไปอยู่ตำแหน่ง <strong>{fromPos}</strong>
              </div>
            </div>
          )}

          <Field label="หมายเหตุ">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="เช่น สลับเพื่อยืดอายุการใช้งาน"
              style={{ resize: 'vertical', minHeight: 48 }}
            />
          </Field>
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={confirm} disabled={!toPos || toPos === fromPos}>
            <Icon name="check" size={15} /> ยืนยันสลับ
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Move to Stock Panel ───────────────────────────────────────────
function MoveToStockPanel() {
  const { profile } = useAuth()
  const vehicles = useFleetVehicles()
  const { data: tires = [] } = useList<Tire>('tires')
  const updateTire = useUpdate<Tire>('tires')
  const insertEvent = useInsert<TireEvent>('tire_events')
  const [vehicleId, setVehicleId] = useState('')
  const [pos, setPos] = useState('')
  const [done, setDone] = useState(false)

  const vTires = vehicleId ? tires.filter((t) => t.vehicleId === vehicleId && t.status === 'in-use') : []
  const wc = wcFrom(vehicles.find((v) => v.id === vehicleId)?.type ?? '')
  const layout = TL[wc] ?? TL[10]
  const allPos = layout.pos.map((p) => p.pos)
  const tireAtPos = vTires.find((t) => t.position === pos)

  const doMove = async () => {
    if (!tireAtPos) return
    const km = computeAccumKm(tireAtPos, vehicles)
    await updateTire.mutateAsync({
      id: tireAtPos.id,
      patch: { status: 'stock', vehicleId: null, position: null, accumulatedKm: km },
    })
    await insertEvent.mutateAsync({
      tireId: tireAtPos.id, vehicleId,
      eventType: 'remove', date: new Date().toISOString().slice(0, 10),
      odometer: vehicles.find((v) => v.id === vehicleId)?.odometer ?? 0,
      fromPos: pos, toPos: null, note: 'ย้ายเข้าคลัง', userId: profile?.id ?? 'e10',
    })
    setDone(true)
    setPos('')
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="head">
        <h3>ย้ายยางเข้าคลังสินค้า</h3>
      </div>
      <div style={{ padding: 20 }}>
        {done && (
          <div style={{ padding: '10px 16px', background: 'var(--bg-sunk)', borderRadius: 8, marginBottom: 16, color: 'var(--green)', fontWeight: 600, fontSize: 13.5 }}>
            ✓ ย้ายยางเข้าคลังเรียบร้อย
            <button className="btn ghost sm" style={{ marginLeft: 12 }} onClick={() => { setDone(false); setVehicleId(''); setPos('') }}>ทำรายการใหม่</button>
          </div>
        )}
        {!done && (
          <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="เลือกรถ">
              <select value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setPos('') }} style={{ height: 38, minWidth: 200 }}>
                <option value="">-- เลือกรถ --</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} ({v.type})</option>)}
              </select>
            </Field>
            <Field label="ตำแหน่งยาง">
              <select value={pos} onChange={(e) => setPos(e.target.value)} style={{ height: 38, minWidth: 160 }} disabled={!vehicleId}>
                <option value="">-- เลือกตำแหน่ง --</option>
                {allPos.map((p) => {
                  const t = vTires.find((tt) => tt.position === p)
                  return <option key={p} value={p}>{p} {t ? `— ${t.serial}` : '(ว่าง)'}</option>
                })}
              </select>
            </Field>
            {tireAtPos && (
              <div style={{ padding: '8px 14px', background: 'var(--primary-50)', borderRadius: 8, fontSize: 13 }}>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{tireAtPos.serial}</span>
                <span className="muted" style={{ marginLeft: 8 }}>{tireAtPos.brand}</span>
              </div>
            )}
            <button className="btn primary" disabled={!tireAtPos} onClick={doMove}>
              ย้ายเข้าคลัง
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 3: Manage & Swap ──────────────────────────────────────────
function TiresManageFull() {
  const { profile } = useAuth()
  const vehicles = useFleetVehicles()
  const { data: tires = [] } = useList<Tire>('tires')
  const { data: tireEvents = [] } = useList<TireEvent>('tire_events')
  const updateTire = useUpdate<Tire>('tires')
  const insertEvent = useInsert<TireEvent>('tire_events')
  const [step, setStep] = useState(1)
  const [sw, setSw] = useState({ vehicleId: '', fromPos: '', toPos: '', note: '' })
  const set = (k: string, v: string) => setSw((s) => ({ ...s, [k]: v }))

  const veh = vehicles.find((v) => v.id === sw.vehicleId)
  const wc = wcFrom(veh?.type ?? '')
  const vTires = sw.vehicleId
    ? tires.filter((t) => t.vehicleId === sw.vehicleId)
    : []
  const tireMap: Record<string, Tire> = {}
  vTires.forEach((t) => {
    if (t.position) tireMap[t.position] = t
  })
  const layout = TL[wc] ?? TL[10]
  const allPos = layout.pos.map((p) => p.pos).concat(['spare_1', 'spare_2'])

  const fromTire = vTires.find((t) => t.position === sw.fromPos)
  const toTire = vTires.find((t) => t.position === sw.toPos)

  const doSwap = async () => {
    if (!sw.vehicleId || !sw.fromPos || !sw.toPos) return
    // Require at least one real tire to move — swapping two empty positions
    // would otherwise write a tire_events row with an empty tireId.
    if (!fromTire && !toTire) { alert('ตำแหน่งที่เลือกว่างทั้งคู่ — ไม่มียางให้สลับ'); return }
    const odometer = veh?.odometer ?? 0
    const userId = profile?.id ?? 'e10'
    const today = new Date().toISOString().slice(0, 10)
    const isSpare = (p: string) => p.startsWith('spare')
    try {
      // Snapshot accumulated km for both tires before swapping; keep status in
      // sync with whether the destination is a spare slot.
      if (fromTire) {
        const km = computeAccumKm(fromTire, vehicles)
        await updateTire.mutateAsync({ id: fromTire.id, patch: { position: sw.toPos, accumulatedKm: km, installedOdometer: odometer, status: isSpare(sw.toPos) ? 'spare' : 'in-use' } })
      }
      if (toTire) {
        const km = computeAccumKm(toTire, vehicles)
        await updateTire.mutateAsync({ id: toTire.id, patch: { position: sw.fromPos, accumulatedKm: km, installedOdometer: odometer, status: isSpare(sw.fromPos) ? 'spare' : 'in-use' } })
      }
      // Record an event for each tire that actually moved (correct tireId + direction).
      if (fromTire) {
        await insertEvent.mutateAsync({
          tireId: fromTire.id, vehicleId: sw.vehicleId, eventType: 'swap', date: today,
          odometer, fromPos: sw.fromPos, toPos: sw.toPos, note: sw.note || 'สลับยาง', userId,
        })
      }
      if (toTire) {
        await insertEvent.mutateAsync({
          tireId: toTire.id, vehicleId: sw.vehicleId, eventType: 'swap', date: today,
          odometer, fromPos: sw.toPos, toPos: sw.fromPos, note: sw.note || 'สลับยาง', userId,
        })
      }
      alert('สลับยางสำเร็จ')
      setSw({ vehicleId: sw.vehicleId, fromPos: '', toPos: '', note: '' })
      setStep(1)
    } catch (e) {
      alert('สลับยางไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const steps = ['เลือกรถ', 'เลือกล้อเดิม', 'เลือกล้อใหม่', 'ยืนยัน']

  return (
    <div>
      {/* Step indicator */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 18 }}>
        <div className="row" style={{ gap: 0 }}>
          {steps.map((s, i) => {
            const n = i + 1
            const done = step > n
            const cur = step === n
            return (
              <div
                key={s}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: i < steps.length - 1 ? 1 : undefined,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 15,
                      background: done
                        ? 'var(--green)'
                        : cur
                          ? 'var(--primary)'
                          : 'var(--bg-sunk)',
                      color: done || cur ? 'white' : 'var(--text-muted)',
                      border: `2px solid ${done ? 'var(--green)' : cur ? 'var(--primary)' : 'var(--line)'}`,
                    }}
                  >
                    {done ? '✓' : n}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: cur ? 'var(--primary)' : done ? 'var(--green)' : 'var(--text-muted)',
                      fontWeight: cur ? 700 : 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: done ? 'var(--green)' : 'var(--line)',
                      margin: '0 8px',
                      marginBottom: 22,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card pad">
        {/* Step 1: Select Vehicle */}
        {step === 1 && (
          <div>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 600 }}>
              ① เลือกรถที่ต้องการสลับยาง
            </h3>
            <div className="tbl-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ทะเบียน</th>
                    <th>ประเภท</th>
                    <th>จำนวนล้อ</th>
                    <th>ยางที่บันทึก</th>
                    <th>เลือก</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vv) => {
                    const wcc = wcFrom(vv.type ?? '')
                    const cnt = tires.filter((t) => t.vehicleId === vv.id).length
                    const sel = sw.vehicleId === vv.id
                    return (
                      <tr
                        key={vv.id}
                        style={{ cursor: 'pointer', background: sel ? 'var(--primary-50)' : undefined }}
                        onClick={() => set('vehicleId', vv.id)}
                      >
                        <td>
                          <span className="mono" style={{ fontWeight: 700 }}>
                            {vv.plate}
                          </span>
                        </td>
                        <td>{vv.type}</td>
                        <td>{wcc} ล้อ</td>
                        <td>
                          <span className="badge blue">{cnt} เส้น</span>
                        </td>
                        <td>
                          <input
                            type="radio"
                            checked={sel}
                            onChange={() => set('vehicleId', vv.id)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {sw.vehicleId && (
              <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
                <button className="btn primary" onClick={() => setStep(2)}>
                  ถัดไป →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select from position */}
        {step === 2 && (
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>
              ② เลือกล้อเดิม (ต้นทาง) — คลิกที่วงล้อ
            </h3>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
              รถ: <strong>{veh?.plate}</strong> · {wc} ล้อ
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '260px 1fr',
                gap: 20,
                alignItems: 'start',
              }}
            >
              <TireMapSVG
                wc={wc}
                tireMap={tireMap}
                selectedPos={sw.fromPos}
                onSelect={(pos) => set('fromPos', pos)}
                selectable={true}
              />
              <div>
                <Field label="หรือเลือกจาก Dropdown">
                  <select
                    value={sw.fromPos}
                    onChange={(e) => set('fromPos', e.target.value)}
                    style={{ height: 42, fontSize: 14 }}
                  >
                    <option value="">-- เลือกตำแหน่งต้นทาง --</option>
                    {allPos.map((p) => {
                      const t = tireMap[p]
                      return (
                        <option key={p} value={p}>
                          {p.startsWith('spare') ? 'ยางสำรอง' : p}{' '}
                          {t ? `— ${t.serial}` : '(ว่าง)'}
                        </option>
                      )
                    })}
                  </select>
                </Field>
                {sw.fromPos && fromTire && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      background: 'var(--primary-50)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>ยางที่เลือก:</div>
                    <Info
                      label="Serial"
                      value={
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {fromTire.serial}
                        </span>
                      }
                    />
                    <Info label="Brand" value={`${fromTire.brand} ${fromTire.model}`} />
                    <Info
                      label="Km สะสม"
                      value={
                        <span
                          style={{
                            color: kmStatus(fromTire.accumulatedKm ?? 0).color,
                            fontWeight: 600,
                          }}
                        >
                          {db.fmt(fromTire.accumulatedKm ?? 0)} km
                        </span>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="row" style={{ marginTop: 18, gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setStep(1)}>
                ← ย้อนกลับ
              </button>
              <button
                className="btn primary"
                onClick={() => setStep(3)}
                disabled={!sw.fromPos}
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select to position */}
        {step === 3 && (
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>
              ③ เลือกล้อใหม่ (ปลายทาง)
            </h3>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
              จาก: <strong>{sw.fromPos.startsWith('spare') ? 'ยางสำรอง' : sw.fromPos}</strong>{' '}
              → คลิกเลือกปลายทาง
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '260px 1fr',
                gap: 20,
                alignItems: 'start',
              }}
            >
              <TireMapSVG
                wc={wc}
                tireMap={tireMap}
                selectedPos={sw.toPos}
                onSelect={(pos) => {
                  if (pos !== sw.fromPos) set('toPos', pos)
                }}
                selectable={true}
              />
              <div>
                <Field label="หรือเลือกจาก Dropdown">
                  <select
                    value={sw.toPos}
                    onChange={(e) => set('toPos', e.target.value)}
                    style={{ height: 42, fontSize: 14 }}
                  >
                    <option value="">-- เลือกตำแหน่งปลายทาง --</option>
                    {allPos
                      .filter((p) => p !== sw.fromPos)
                      .map((p) => {
                        const t = tireMap[p]
                        return (
                          <option key={p} value={p}>
                            {p.startsWith('spare') ? 'ยางสำรอง' : p}{' '}
                            {t ? `— ${t.serial}` : '(ว่าง)'}
                          </option>
                        )
                      })}
                  </select>
                </Field>
                {sw.toPos && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      background: 'var(--bg-sunk)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      ปลายทางที่เลือก:{' '}
                      <span style={{ color: 'var(--primary)' }}>
                        {sw.toPos.startsWith('spare') ? 'ยางสำรอง' : sw.toPos}
                      </span>
                    </div>
                    {toTire ? (
                      <>
                        <Info
                          label="Serial ปัจจุบัน"
                          value={<span className="mono">{toTire.serial}</span>}
                        />
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          * ยางที่อยู่ตำแหน่งนี้จะสลับมาอยู่ที่{' '}
                          {sw.fromPos.startsWith('spare') ? 'ยางสำรอง' : sw.fromPos} แทน
                        </div>
                      </>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>
                        ตำแหน่งว่าง
                      </div>
                    )}
                  </div>
                )}
                <Field label="หมายเหตุ (ไม่บังคับ)">
                  <textarea
                    value={sw.note}
                    onChange={(e) => set('note', e.target.value)}
                    rows={2}
                    placeholder="เช่น หมุนยาง หน้า-หลัง"
                    style={{ marginTop: 12 }}
                  />
                </Field>
              </div>
            </div>
            <div className="row" style={{ marginTop: 18, gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setStep(2)}>
                ← ย้อนกลับ
              </button>
              <button
                className="btn primary"
                onClick={() => setStep(4)}
                disabled={!sw.toPos}
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 600 }}>
              ④ ยืนยันการสลับยาง
            </h3>
            <div
              style={{ padding: 22, background: 'var(--bg-sunk)', borderRadius: 12, marginBottom: 18 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    padding: 16,
                    background: '#fff',
                    borderRadius: 10,
                    border: '2px solid var(--primary)',
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>
                    ยางต้นทาง
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {sw.fromPos.startsWith('spare') ? 'ยางสำรอง' : sw.fromPos}
                  </div>
                  {fromTire && (
                    <div className="mono" style={{ fontSize: 13, color: 'var(--primary)', marginTop: 4 }}>
                      {fromTire.serial}
                    </div>
                  )}
                  {fromTire && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {db.fmt(fromTire.accumulatedKm ?? 0)} km
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 28, color: 'var(--primary)', fontWeight: 700 }}>↔</div>
                <div
                  style={{
                    padding: 16,
                    background: '#fff',
                    borderRadius: 10,
                    border: '2px solid var(--amber)',
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>
                    ยางปลายทาง
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {sw.toPos.startsWith('spare') ? 'ยางสำรอง' : sw.toPos}
                  </div>
                  {toTire ? (
                    <>
                      <div className="mono" style={{ fontSize: 13, color: 'var(--amber)', marginTop: 4 }}>
                        {toTire.serial}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {db.fmt(toTire.accumulatedKm ?? 0)} km
                      </div>
                    </>
                  ) : (
                    <div className="muted" style={{ fontSize: 12 }}>
                      ตำแหน่งว่าง
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
              >
                <Info label="รถ" value={<span className="mono">{veh?.plate}</span>} />
                <Info
                  label="เลขไมล์"
                  value={<span className="mono">{db.fmt(veh?.odometer ?? 0)} km</span>}
                />
                <Info
                  label="วันที่"
                  value={db.thaiDate(new Date().toISOString().slice(0, 10))}
                />
                <Info label="หมายเหตุ" value={sw.note || '—'} />
              </div>
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setStep(1)}>
                ยกเลิก
              </button>
              <button className="btn primary" onClick={doSwap}>
                ยืนยันการสลับ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Move to stock */}
      <MoveToStockPanel />

      {/* Swap history */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="head">
          <h3>ประวัติการสลับยางล่าสุด</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ทะเบียน</th>
                <th>Serial</th>
                <th>จากตำแหน่ง</th>
                <th>ไปตำแหน่ง</th>
                <th className="right">เลขไมล์</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {tireEvents
                .filter((e) => e.eventType === 'swap')
                .slice(0, 10)
                .map((e) => {
                  const vv = vehicles.find((v) => v.id === e.vehicleId)
                  const t = tires.find((tt) => tt.id === e.tireId)
                  return (
                    <tr key={e.id}>
                      <td className="num muted">{db.thaiDate(e.date)}</td>
                      <td>
                        <a style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">
                          {vv?.plate}
                        </a>
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {t?.serial ?? '—'}
                      </td>
                      <td>
                        <span className="badge gray">{e.fromPos ?? '—'}</span>
                      </td>
                      <td>
                        <span className="badge blue">{e.toPos ?? '—'}</span>
                      </td>
                      <td className="num right mono">{db.fmt(e.odometer)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>
                        {e.note}
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

// ── Tab 4: History Timeline ───────────────────────────────────────
function TiresHistoryFull() {
  const { data: tires = [] } = useList<Tire>('tires')
  const vehicles = useFleetVehicles()
  const { data: allEvents = [] } = useList<TireEvent>('tire_events')
  const initial = (typeof window !== 'undefined' && sessionStorage.getItem('kps_tire_history_serial')) || ''
  const [q, setQ] = useState(initial)
  const [searched, setSearched] = useState(initial)
  useEffect(() => {
    if (initial) sessionStorage.removeItem('kps_tire_history_serial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tire = searched
    ? tires.find((t) => t.serial.toLowerCase().includes(searched.toLowerCase()))
    : null
  const vehicle = tire?.vehicleId ? vehicles.find((v) => v.id === tire.vehicleId) : null

  const events = useMemo(() => {
    if (!tire) return []
    return allEvents
      .filter((e) => e.tireId === tire.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allEvents, tire?.id, tire])

  const handleSearch = () => setSearched(q.trim())

  const EVT_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    install: { label: 'ซื้อ / ติดตั้งยางใหม่', icon: '🛒', color: '#16a34a', bg: '#dcfce7' },
    swap: { label: 'สลับตำแหน่ง', icon: '↔', color: '#2563eb', bg: '#dbeafe' },
    remove: { label: 'ถอดซ่อม / ปะยาง', icon: '🔧', color: '#d97706', bg: '#fef3c7' },
    sell: { label: 'ขายออก / จำหน่าย', icon: '💰', color: '#dc2626', bg: '#fee2e2' },
    // Without this, scrap events fell back to EVT_CFG.install and rendered as a
    // green "purchase/install" card on the tire's timeline.
    scrap: { label: 'หมดสภาพ / คัดทิ้ง', icon: '🗑', color: '#64748b', bg: '#f1f5f9' },
  }

  return (
    <div>
      {/* Search bar */}
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>ค้นหาประวัติยางรายเส้น</div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icon
              name="search"
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
              }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="กรอกเลขซีเรียลยาง เช่น TIR0001"
              style={{
                width: '100%',
                height: 42,
                padding: '0 12px 0 36px',
                border: '1px solid var(--line)',
                borderRadius: 8,
                background: 'var(--bg)',
                fontSize: 14,
              }}
            />
          </div>
          <button
            className="btn primary"
            onClick={handleSearch}
            style={{ height: 42, paddingInline: 20 }}
          >
            ค้นหา
          </button>
        </div>
      </div>

      {/* Not found */}
      {searched && !tire && (
        <div className="card pad" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          ไม่พบยางที่มีซีเรียล: <strong>{searched}</strong>
        </div>
      )}

      {/* Tire info header card */}
      {tire && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 18 }}>
            <div className="row" style={{ gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#dbeafe',
                  border: '3px solid #2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 12, color: '#1d4ed8', textAlign: 'center' }}>
                  {tire.position ?? 'คลัง'}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 10, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 18 }}>{tire.serial}</span>
                  <span className={`badge ${LOC_LABEL[tire.status]?.cls ?? 'gray'}`}>
                    {LOC_LABEL[tire.status]?.label ?? tire.status}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 6 }}>
                  {tire.brand} {tire.model} · {tire.size}
                </div>
                <div className="row" style={{ gap: 18, fontSize: 13, flexWrap: 'wrap' }}>
                  {vehicle ? (
                    <span>
                      รถ:{' '}
                      <strong className="mono" style={{ color: 'var(--primary)' }}>
                        {vehicle.plate}
                      </strong>
                      <span className="muted"> ({vehicle.type})</span>
                    </span>
                  ) : (
                    <span className="muted">ไม่ได้ติดตั้งบนรถ</span>
                  )}
                  <span>
                    Km สะสม:{' '}
                    <strong style={{ color: kmStatus(tire.accumulatedKm ?? 0).color }}>
                      {db.fmt(tire.accumulatedKm ?? 0)} km
                    </strong>
                  </span>
                  <span className="muted">ติดตั้งเมื่อ: {db.thaiDate(tire.installedDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {events.length === 0 ? (
            <div className="card pad" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              ยังไม่มีประวัติการใช้งานยางเส้นนี้
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: 'var(--text-2)' }}>
                ประวัติการใช้งาน ({events.length} รายการ)
              </div>
              {events.map((e, i) => {
                const v = vehicles.find((vv) => vv.id === e.vehicleId)
                const cfg = EVT_CFG[e.eventType] ?? EVT_CFG.install
                const isLast = i === events.length - 1
                return (
                  <div
                    key={e.id}
                    style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 14 }}
                  >
                    {/* Spine */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: cfg.bg,
                          border: `2px solid ${cfg.color}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          color: cfg.color,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {cfg.icon}
                      </div>
                      {!isLast && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            minHeight: 20,
                            background: 'var(--line)',
                            marginTop: 4,
                          }}
                        />
                      )}
                    </div>
                    {/* Event card */}
                    <div className="card" style={{ padding: 16, marginBottom: isLast ? 0 : 12 }}>
                      <div className="row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>
                            {cfg.label}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {db.thaiDate(e.date)}
                          </div>
                        </div>
                        {v && (
                          <span
                            className="mono"
                            style={{
                              fontWeight: 600,
                              color: 'var(--primary)',
                              marginLeft: 'auto',
                              fontSize: 13,
                            }}
                          >
                            {v.plate}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 10,
                          fontSize: 13,
                          paddingTop: 10,
                          borderTop: '1px solid var(--line)',
                        }}
                      >
                        <Info
                          label="เลขไมล์"
                          value={<span className="mono">{db.fmt(e.odometer)} km</span>}
                        />
                        {(e.fromPos || e.toPos) && (
                          <Info
                            label="ตำแหน่ง"
                            value={
                              <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                                {e.fromPos && (
                                  <span className="badge gray" style={{ fontSize: 11 }}>
                                    {e.fromPos.startsWith('spare') ? 'สำรอง' : e.fromPos}
                                  </span>
                                )}
                                {e.fromPos && e.toPos && (
                                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                                )}
                                {e.toPos && (
                                  <span className="badge blue" style={{ fontSize: 11 }}>
                                    {e.toPos.startsWith('spare') ? 'สำรอง' : e.toPos}
                                  </span>
                                )}
                              </span>
                            }
                          />
                        )}
                      </div>
                      {e.note && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '8px 12px',
                            background: '#fee2e2',
                            borderRadius: 6,
                            fontSize: 12.5,
                            color: '#991b1b',
                          }}
                        >
                          หมายเหตุ: {e.note}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Empty state — no search yet */}
      {!searched && (
        <div
          className="card pad"
          style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}
        >
          <Icon name="search" size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>
            กรอกเลขซีเรียลยางแล้วกด "ค้นหา" เพื่อดูประวัติรายเส้น
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 5: Scrapped Tires ─────────────────────────────────────────
function SellScrapModal({ tire, onClose, onSaved }: { tire: Tire; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth()
  const insertSale = useInsert<TireScrapSale>('tire_scrap_sales')
  const insertEvent = useInsert<TireEvent>('tire_events')
  const updateTire = useUpdate<Tire>('tires')
  const [buyer, setBuyer] = useState('')
  const [price, setPrice] = useState('')

  const save = async () => {
    if (!buyer || !price) { alert('กรุณากรอกผู้ซื้อและราคา'); return }
    const priceNum = +price
    if (!Number.isFinite(priceNum) || priceNum < 0) { alert('ราคาต้องไม่ติดลบ'); return }
    try {
      const today = new Date().toISOString().slice(0, 10)
      await insertSale.mutateAsync({
        tireId: tire.id, serial: tire.serial,
        buyer: buyer.trim(), price: priceNum,
        date: today, userId: profile?.id ?? 'e10',
      })
      // Record the sale on the tire's own timeline (the history views render a
      // 'sell' event; without this the timeline ended at 'scrap').
      await insertEvent.mutateAsync({
        tireId: tire.id, vehicleId: tire.vehicleId ?? '', eventType: 'sell',
        date: today, odometer: 0, fromPos: tire.position ?? null, toPos: null,
        note: `ขายให้ ${buyer.trim()} · ${priceNum} บาท`, userId: profile?.id ?? 'e10',
      })
      await updateTire.mutateAsync({ id: tire.id, patch: { status: 'sold' } })
      onSaved()
      onClose()
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="card" style={{ width: 420, maxWidth: '95vw' }}>
        <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>บันทึกขายซาก</h3>
          <button className="btn ghost icon sm" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: 22 }} className="col">
          <div style={{ padding: '10px 14px', background: 'var(--bg-sunk)', borderRadius: 8, marginBottom: 14 }}>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)', marginRight: 10 }}>{tire.serial}</span>
            <span className="muted">{tire.brand} {tire.model}</span>
          </div>
          <Field label="ผู้ซื้อ *">
            <input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="ชื่อผู้ซื้อ / ร้าน" />
          </Field>
          <Field label="ราคาขาย (บาท) *">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" style={{ marginTop: 10 }} />
          </Field>
        </div>
        <div className="row" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  )
}

function TiresScrapped() {
  const { data: allTires = [] } = useList<Tire>('tires')
  const { data: sales = [] } = useList<TireScrapSale>('tire_scrap_sales')
  const scrapped = useMemo(() => allTires.filter((t) => t.status === 'scrapped'), [allTires])
  const [sellTire, setSellTire] = useState<Tire | null>(null)

  const saleByTireId = useMemo(() => {
    const m: Record<string, TireScrapSale> = {}
    sales.forEach((s) => { m[s.tireId] = s })
    return m
  }, [sales])

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head">
          <h3>รายการยางหมดสภาพ ({scrapped.length} เส้น)</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>เลขซีเรียล</th>
                <th>ยี่ห้อ</th>
                <th>ขนาด</th>
                <th className="right">Km สะสม</th>
                <th>สถานะขายซาก</th>
                <th>ดำเนิน</th>
              </tr>
            </thead>
            <tbody>
              {scrapped.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>ยังไม่มียางหมดสภาพ</td></tr>
              )}
              {scrapped.map((t) => {
                const sale = saleByTireId[t.id]
                return (
                  <tr key={t.id}>
                    <td><span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{t.serial}</span></td>
                    <td>{t.brand}</td>
                    <td className="mono muted">{t.size || '—'}</td>
                    <td className="num right mono">{db.fmt(t.accumulatedKm ?? 0)}</td>
                    <td>
                      {sale ? (
                        <span className="badge green">ขายซากแล้ว</span>
                      ) : (
                        <span className="badge gray">ยังไม่ขาย</span>
                      )}
                    </td>
                    <td>
                      {!sale && (
                        <button className="btn sm primary" onClick={() => setSellTire(t)}>
                          บันทึกขายซาก
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scrap sale history */}
      <div className="card">
        <div className="head">
          <h3>ประวัติขายซาก ({sales.length} รายการ)</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>เลขซีเรียล</th>
                <th>ผู้ซื้อ</th>
                <th className="right">ราคา</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>ยังไม่มีประวัติขายซาก</td></tr>
              )}
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="num muted">{db.thaiDate(s.date)}</td>
                  <td><span className="mono" style={{ fontWeight: 600 }}>{s.serial}</span></td>
                  <td>{s.buyer}</td>
                  <td className="num right mono">{db.thb(s.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sellTire && (
        <SellScrapModal
          tire={sellTire}
          onClose={() => setSellTire(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}

// ── Module Router ─────────────────────────────────────────────────
export function TiresModule({ tab, setActive }: { tab: string; setActive: (id: string) => void }) {
  const cur =
    tab === 'layout'
      ? 'layout'
      : tab === 'manage'
        ? 'manage'
        : tab === 'history'
          ? 'history'
          : tab === 'scrapped'
            ? 'scrapped'
            : 'all'
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ระบบยาง</h1>
        </div>
        {cur === 'all' && (
          <div className="actions">
            <button className="btn primary" onClick={() => setShowAdd(true)}>
              <Icon name="plus" size={14} /> เพิ่มยางใหม่
            </button>
          </div>
        )}
      </div>
      <div className="tabs" style={{ marginBottom: 22 }}>
        {(
          [
            ['all', '', 'รายการยางทั้งหมด'],
            ['layout', 'layout', 'ผังยางปัจจุบัน'],
            ['manage', 'manage', 'จัดการและสลับยาง'],
            ['history', 'history', 'ประวัติยางรายเส้น'],
            ['scrapped', 'scrapped', 'ยางหมดสภาพ'],
          ] as [string, string, string][]
        ).map(([id, route, label]) => (
          <button
            key={id}
            className={`tab ${cur === id ? 'active' : ''}`}
            onClick={() => setActive('tires' + (route ? '.' + route : ''))}
          >
            {label}
          </button>
        ))}
      </div>
      {cur === 'all' && <TiresAll setActive={setActive} />}
      {cur === 'layout' && <TiresLayout />}
      {cur === 'manage' && <TiresManageFull />}
      {cur === 'history' && <TiresHistoryFull />}
      {cur === 'scrapped' && <TiresScrapped />}
      {showAdd && <AddTireModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
