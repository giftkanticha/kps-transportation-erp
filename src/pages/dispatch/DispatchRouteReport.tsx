import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { usePrint } from '../../hooks/usePrint'
import type { Route, Customer, Dispatch, DispatchLeg } from '../../types'
import { Icon, Field, SearchInput } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject?: (s: unknown) => void
  setRoutePrefill?: (p: { origin: string; destination: string } | null) => void
}

type SortKey = 'count' | 'revenue' | 'recent' | 'distance'

interface RouteRow {
  key: string                  // routeId or `${origin}||${destination}`
  routeId: string | null       // null = unmapped
  route?: Route
  origin: string
  destination: string
  legCount: number
  totalWeight: number
  totalDistance: number        // approximate: route.distanceKm × count, only when route has distance
  totalRevenue: number
  totalPerDiem: number
  avgRevenue: number
  lastDate: string
  customers: Set<string>
}

export function DispatchRouteReport({ setActive, setRoutePrefill }: Props) {
  const today = new Date()
  // Default: year-to-date — route analytics usually want a wider window than
  // monthly P&L reports.
  const [from, setFrom] = useState(`${today.getFullYear()}-01-01`)
  const [to, setTo] = useState(today.toISOString().slice(0, 10))
  const [customerId, setCustomerId] = useState('')
  const [destFilter, setDestFilter] = useState('')
  const [routeFilter, setRouteFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [includeUnmapped, setIncludeUnmapped] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('count')
  const [q, setQ] = useState('')

  const { data: routes = [] } = useList<Route>('routes')
  const { data: customers = [] } = useList<Customer>('customers')
  const { data: dispatches = [] } = useDispatches()
  const { print } = usePrint()

  // Build the full leg pool (legs from rounds that survived the date filter)
  const filteredLegs = useMemo(() => {
    const out: Array<{ leg: DispatchLeg; round: Dispatch; date: string }> = []
    for (const d of dispatches) {
      const status = d.roundStatus
      if (status !== 'draft' && status !== 'closed' && d.status !== 'completed') continue
      const dt = (d.depart || d.date || '').slice(0, 10)
      if (from && dt < from) continue
      if (to && dt > to) continue
      for (const l of (d.legs ?? [])) {
        if (customerId && (l.customerId ?? d.customerId) !== customerId) continue
        out.push({ leg: l, round: d, date: dt })
      }
    }
    return out
  }, [dispatches, from, to, customerId])

  // Group legs by resolved routeId (or unmapped composite key)
  const rows = useMemo<RouteRow[]>(() => {
    const groups = new Map<string, RouteRow>()
    for (const { leg, round, date } of filteredLegs) {
      const routeId = db.resolveRouteId(leg, routes)
      const route = routeId ? routes.find(r => r.id === routeId) : undefined
      const key = routeId ?? `__unmapped__||${leg.origin.trim().toLowerCase()}||${leg.destination.trim().toLowerCase()}`
      let row = groups.get(key)
      if (!row) {
        row = {
          key,
          routeId,
          route,
          origin: route?.origin ?? leg.origin,
          destination: route?.destination ?? leg.destination,
          legCount: 0,
          totalWeight: 0,
          totalDistance: 0,
          totalRevenue: 0,
          totalPerDiem: 0,
          avgRevenue: 0,
          lastDate: '',
          customers: new Set<string>(),
        }
        groups.set(key, row)
      }
      row.legCount += 1
      row.totalWeight += leg.weight || 0
      row.totalRevenue += leg.amount || 0
      row.totalPerDiem += leg.perDiem || 0
      if (route?.distanceKm != null) row.totalDistance += route.distanceKm
      if (date > row.lastDate) row.lastDate = date
      const cid = leg.customerId ?? round.customerId
      if (cid) row.customers.add(cid)
    }
    let arr = [...groups.values()]
    arr.forEach(r => { r.avgRevenue = r.legCount > 0 ? r.totalRevenue / r.legCount : 0 })
    return arr
  }, [filteredLegs, routes])

  const visibleRows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let arr = rows.filter(r => {
      if (!includeUnmapped && r.routeId == null) return false
      if (!includeInactive && r.route && !r.route.active) return false
      if (destFilter && r.destination !== destFilter) return false
      if (routeFilter && r.routeId !== routeFilter) return false
      if (!needle) return true
      return [r.route?.code, r.route?.name, r.origin, r.destination]
        .filter(Boolean).join(' ').toLowerCase().includes(needle)
    })
    if (sortKey === 'count')    arr.sort((a, b) => b.legCount - a.legCount)
    if (sortKey === 'revenue')  arr.sort((a, b) => b.totalRevenue - a.totalRevenue)
    if (sortKey === 'recent')   arr.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    if (sortKey === 'distance') arr.sort((a, b) => b.totalDistance - a.totalDistance)
    return arr
  }, [rows, q, includeInactive, includeUnmapped, destFilter, routeFilter, sortKey])

  // Unique destinations seen in current filter scope (for dest dropdown)
  const destinations = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => { if (r.destination) set.add(r.destination) })
    return [...set].sort()
  }, [rows])

  const totals = useMemo(() => {
    return visibleRows.reduce(
      (a, r) => ({
        legCount: a.legCount + r.legCount,
        revenue:  a.revenue + r.totalRevenue,
        perDiem:  a.perDiem + r.totalPerDiem,
        distance: a.distance + r.totalDistance,
        weight:   a.weight + r.totalWeight,
      }),
      { legCount: 0, revenue: 0, perDiem: 0, distance: 0, weight: 0 },
    )
  }, [visibleRows])

  const unmappedCount = rows.filter(r => r.routeId == null).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานเส้นทาง</h1>
          <div className="page-sub">
            จัดกลุ่มเที่ยวขนส่งตามเส้นทาง (ต้นทาง × ปลายทาง) — ดูได้เลยว่าวิ่งเส้นไหนบ่อย / ทำเงินที่สุด
          </div>
        </div>
        <div className="actions no-print">
          <button className="btn" onClick={() => print('landscape')}>
            <Icon name="download" size={15} /> พิมพ์ / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad no-print" style={{ marginBottom: 14 }}>
        <div className="grid-4" style={{ gap: 12 }}>
          <Field label="จาก">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึง">
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </Field>
          <Field label="ลูกค้า">
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="เรียงตาม">
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
              <option value="count">จำนวนเที่ยว (มาก → น้อย)</option>
              <option value="revenue">รายได้ (มาก → น้อย)</option>
              <option value="recent">ล่าสุด</option>
              <option value="distance">ระยะทาง (มาก → น้อย)</option>
            </select>
          </Field>
        </div>
        <div className="grid-4" style={{ gap: 12, marginTop: 12 }}>
          <Field label="ปลายทาง">
            <select value={destFilter} onChange={e => setDestFilter(e.target.value)}>
              <option value="">ทุกปลายทาง</option>
              {destinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="เส้นทาง">
            <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)}>
              <option value="">ทุกเส้นทาง</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name || `${r.origin} → ${r.destination}`}
                </option>
              ))}
            </select>
          </Field>
          <div className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={includeUnmapped}
                onChange={e => setIncludeUnmapped(e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span>รวมขาที่ไม่ระบุเส้นทาง ({unmappedCount})</span>
            </label>
          </div>
          <div className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={e => setIncludeInactive(e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span>รวมเส้นทางที่ปิดใช้งาน</span>
            </label>
          </div>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'center', marginTop: 12 }}>
          <SearchInput value={q} onChange={setQ} placeholder="ค้นหา รหัส / ต้นทาง / ปลายทาง..." />
          <span className="muted" style={{ fontSize: 13 }}>{visibleRows.length} เส้นทาง</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid-4" style={{ marginBottom: 14, gap: 12 }}>
        <div className="card kpi">
          <div className="label">จำนวนเที่ยวรวม</div>
          <div className="row">
            <div className="icn-box"><Icon name="trip" size={18} /></div>
            <div className="value">{db.fmt(totals.legCount)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">รายได้รวม</div>
          <div className="row">
            <div className="icn-box green"><Icon name="money" size={18} /></div>
            <div className="value">{db.thb(totals.revenue)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">เบี้ยเลี้ยงรวม</div>
          <div className="row">
            <div className="icn-box amber"><Icon name="wallet" size={18} /></div>
            <div className="value">{db.thb(totals.perDiem)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ระยะทางรวม (ประมาณ)</div>
          <div className="row">
            <div className="icn-box"><Icon name="gauge" size={18} /></div>
            <div className="value">{db.fmt(totals.distance)}<span className="unit">km</span></div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="head">
          <h3>เส้นทางในช่วงเวลา ({visibleRows.length})</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>เส้นทาง</th>
                <th>ลูกค้าที่ใช้</th>
                <th className="num">เที่ยว</th>
                <th className="num">น้ำหนัก (ตัน)</th>
                <th className="num">ระยะทาง</th>
                <th className="num">รายได้รวม</th>
                <th className="num">รายได้/เที่ยว</th>
                <th className="num">เบี้ยเลี้ยงรวม</th>
                <th>ล่าสุด</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(r => {
                const custNames = [...r.customers].map(cid =>
                  customers.find(c => c.id === cid)?.name).filter(Boolean) as string[]
                return (
                  <tr key={r.key} style={r.routeId == null ? { background: '#FFFBEB' } : undefined}>
                    <td className="mono" style={{ fontWeight: 600, color: r.routeId ? 'var(--primary)' : 'var(--amber)' }}>
                      {r.route?.code ?? <span title="ไม่มี route master">—</span>}
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>
                        {r.route?.name || `${r.origin} → ${r.destination}`}
                      </div>
                      {!r.route && (
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          {r.origin} → {r.destination}
                        </div>
                      )}
                      {r.routeId == null && (
                        <span className="badge amber" style={{ fontSize: 10, marginTop: 4 }}>ไม่ระบุเส้นทาง</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {custNames.length === 0 ? <span className="muted">—</span>
                        : custNames.length <= 2 ? custNames.join(', ')
                          : `${custNames.slice(0, 2).join(', ')} +${custNames.length - 2}`}
                    </td>
                    <td className="num">{r.legCount}</td>
                    <td className="num mono">{r.totalWeight.toFixed(1)}</td>
                    <td className="num mono">{r.totalDistance > 0 ? db.fmt(r.totalDistance) : '—'}</td>
                    <td className="num mono" style={{ fontWeight: 600 }}>{db.thb(r.totalRevenue)}</td>
                    <td className="num mono">{db.thb(r.avgRevenue)}</td>
                    <td className="num mono">{db.thb(r.totalPerDiem)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{r.lastDate || '—'}</td>
                    <td className="no-print">
                      {r.routeId == null && setRoutePrefill && (
                        <button
                          className="btn ghost sm"
                          title="สร้างเป็นเส้นทาง master"
                          onClick={() => {
                            setRoutePrefill({ origin: r.origin, destination: r.destination })
                            setActive('settings.routes')
                          }}
                        >
                          <Icon name="plus" size={12} /> สร้างเส้นทาง
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 36, color: 'var(--text-2)' }}>
                    ไม่พบเส้นทางในช่วงเวลาที่เลือก
                  </td>
                </tr>
              )}
              {visibleRows.length > 0 && (
                <tr style={{ fontWeight: 600, background: 'var(--bg)' }}>
                  <td colSpan={3} className="right">รวม {visibleRows.length} เส้นทาง</td>
                  <td className="num">{totals.legCount}</td>
                  <td className="num mono">{totals.weight.toFixed(1)}</td>
                  <td className="num mono">{totals.distance > 0 ? db.fmt(totals.distance) : '—'}</td>
                  <td className="num mono" style={{ color: 'var(--green)' }}>{db.thb(totals.revenue)}</td>
                  <td></td>
                  <td className="num mono">{db.thb(totals.perDiem)}</td>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
