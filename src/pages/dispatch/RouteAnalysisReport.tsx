import { useMemo } from 'react'
import { db, ROUTE_ANOMALY_PCT, ROUTE_MIN_SAMPLES } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useSessionState } from '../../hooks/useSessionState'
import {
  useRouteAnomalies, routeGroupKey, routeTripFlags,
  type RouteTripRow, type RouteBaseline,
} from '../../hooks/useRouteAnomalies'
import type { Vehicle } from '../../types'
import { Icon, Field, SegmentedFilter } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
}

type KindFilter = 'all' | 'loaded' | 'deadhead'
type TripRow = RouteTripRow
type Baseline = RouteBaseline
const groupKey = routeGroupKey
const tripFlags = routeTripFlags

function pctText(p: number | null): string {
  if (p == null) return '—'
  const sign = p > 0 ? '+' : ''
  return `${sign}${(p * 100).toFixed(0)}%`
}

export function RouteAnalysisReport({ setActive, setSubject }: Props) {
  const today = new Date()
  // หน้านี้เอาไว้วิเคราะห์แนวโน้ม ไม่ใช่รายงานประจำเดือนแบบหน้าอื่น จึงเริ่มต้นแบบไม่จำกัด
  // วันที่ (แสดงเที่ยวย้อนหลังทั้งหมด) แทนการเริ่มที่ต้นเดือนปัจจุบันซึ่งจะบังเที่ยวเก่ากว่านั้น
  const [from, setFrom] = useSessionState('route_analysis_from', '')
  const [to, setTo] = useSessionState('route_analysis_to', today.toISOString().slice(0, 10))
  const [vehicleId, setVehicleId] = useSessionState('route_analysis_vehicle', '')
  const [kindFilter, setKindFilter] = useSessionState<KindFilter>('route_analysis_kind', 'all')
  const [routeQuery, setRouteQuery] = useSessionState('route_analysis_query', '')

  const { trips: allTrips, baselineMap } = useRouteAnomalies()
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const transportVehicles = useMemo(
    () => vehicles.filter(v => (v.groupKind ?? 'TRANSPORT') === 'TRANSPORT'),
    [vehicles],
  )

  // เที่ยวในช่วงตัวกรองที่เลือก — ใช้แสดงผลและตรวจความผิดปกติ
  const filteredTrips = useMemo(() => {
    return allTrips.filter(t => {
      if (from && t.date < from) return false
      if (to && t.date > to) return false
      if (vehicleId && t.round.vehicleId !== vehicleId) return false
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false
      if (routeQuery && !t.routeLabel.toLowerCase().includes(routeQuery.toLowerCase())) return false
      return true
    })
  }, [allTrips, from, to, vehicleId, kindFilter, routeQuery])

  const flaggedTrips = useMemo(() => {
    return filteredTrips
      .map(t => ({ trip: t, flags: tripFlags(t, baselineMap.get(groupKey(t.routeLabel, t.legCount, t.kind))) }))
      .filter(x => x.flags.anomaly)
      .sort((a, b) => {
        const av = Math.max(Math.abs(a.flags.distancePct ?? 0), Math.abs(a.flags.fuelPct ?? 0))
        const bv = Math.max(Math.abs(b.flags.distancePct ?? 0), Math.abs(b.flags.fuelPct ?? 0))
        return bv - av
      })
  }, [filteredTrips, baselineMap])

  const summaryRows = useMemo(() => {
    const groups = new Map<string, TripRow[]>()
    filteredTrips.forEach(t => {
      const k = groupKey(t.routeLabel, t.legCount, t.kind)
      const arr = groups.get(k) ?? []
      arr.push(t)
      groups.set(k, arr)
    })
    const out: Array<{
      key: string; routeLabel: string; legCount: number; kind: 'loaded' | 'deadhead'
      count: number; avgDistance: number; base: Baseline | undefined
      distancePct: number | null; avgKmPerL: number | null; fuelPct: number | null
      anomalyCount: number; sampleOk: boolean
    }> = []
    groups.forEach((trips, k) => {
      const base = baselineMap.get(k)
      const count = trips.length
      const avgDistance = trips.reduce((s, t) => s + t.distance, 0) / count
      const withFuel = trips.filter(t => t.kmPerL != null)
      const avgKmPerL = withFuel.length
        ? withFuel.reduce((s, t) => s + (t.kmPerL as number), 0) / withFuel.length
        : null
      const sampleOk = !!base && base.n >= ROUTE_MIN_SAMPLES
      const distancePct = sampleOk && base ? (avgDistance - base.meanDistance) / base.meanDistance : null
      const fuelPct = sampleOk && base?.meanKmPerL && avgKmPerL != null
        ? (avgKmPerL - base.meanKmPerL) / base.meanKmPerL
        : null
      const anomalyCount = trips.filter(t => tripFlags(t, base).anomaly).length
      out.push({
        key: k, routeLabel: trips[0].routeLabel, legCount: trips[0].legCount, kind: trips[0].kind,
        count, avgDistance, base, distancePct, avgKmPerL, fuelPct, anomalyCount, sampleOk,
      })
    })
    return out.sort((a, b) => b.anomalyCount - a.anomalyCount || b.count - a.count)
  }, [filteredTrips, baselineMap])

  const totalAnomalies = flaggedTrips.length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">วิเคราะห์เที่ยววิ่งตามเส้นทาง</h1>
          <div className="page-sub">
            เทียบระยะทาง/อัตราน้ำมันแต่ละเที่ยวกับค่าเฉลี่ยของเส้นทางเดียวกัน (แยกตีเปล่า/มีสินค้า) — ผิดปกติเมื่อต่างจากค่าเฉลี่ยเกิน ±{(ROUTE_ANOMALY_PCT * 100).toFixed(0)}% และมีเที่ยวย้อนหลังพอ (≥{ROUTE_MIN_SAMPLES} เที่ยว)
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="grid-4" style={{ gap: 12 }}>
          <Field label="จาก">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึง">
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </Field>
          <Field label="รถ">
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {transportVehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
            </select>
          </Field>
          <Field label="ค้นหาเส้นทาง">
            <input
              type="text"
              placeholder="เช่น KPS, สันกอก"
              value={routeQuery}
              onChange={e => setRouteQuery(e.target.value)}
            />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 10, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>ประเภทเที่ยว:</span>
          <SegmentedFilter
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { value: 'all', label: 'ทั้งหมด' },
              { value: 'loaded', label: 'มีสินค้า' },
              { value: 'deadhead', label: 'ตีเปล่า' },
            ]}
          />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid-4" style={{ marginBottom: 16, gap: 12 }}>
        <div className="card kpi">
          <div className="label">เที่ยวในช่วงที่เลือก</div>
          <div className="row"><div className="icn-box"><Icon name="package" size={18} /></div>
            <div className="value">{filteredTrips.length}</div></div>
        </div>
        <div className="card kpi">
          <div className="label">เส้นทางที่วิเคราะห์</div>
          <div className="row"><div className="icn-box"><Icon name="pin" size={18} /></div>
            <div className="value">{summaryRows.length}</div></div>
        </div>
        <div className="card kpi">
          <div className="label">เที่ยวผิดปกติ</div>
          <div className="row">
            <div className={`icn-box ${totalAnomalies > 0 ? 'red' : 'green'}`}><Icon name="alert" size={18} /></div>
            <div className="value" style={{ color: totalAnomalies > 0 ? 'var(--red)' : undefined }}>
              {totalAnomalies}
            </div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">สัดส่วนผิดปกติ</div>
          <div className="row"><div className="icn-box amber"><Icon name="chart" size={18} /></div>
            <div className="value">
              {filteredTrips.length > 0 ? `${((totalAnomalies / filteredTrips.length) * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {totalAnomalies > 0 && (
        <div
          style={{
            padding: 12, marginBottom: 14, borderRadius: 8,
            background: '#FEE2E2', border: '1px solid #EF4444', fontSize: 13,
          }}
        >
          ⚠️ พบ <strong>{totalAnomalies}</strong> เที่ยวผิดปกติ — ระยะทางเกินค่าเฉลี่ยเส้นทางเดียวกันมากกว่า {(ROUTE_ANOMALY_PCT * 100).toFixed(0)}% หรืออัตราน้ำมัน (KM/L) ต่ำกว่าค่าเฉลี่ยเกิน {(ROUTE_ANOMALY_PCT * 100).toFixed(0)}%
        </div>
      )}

      {/* Route summary table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="head">
          <h3>สรุปตามเส้นทาง ({summaryRows.length} เส้นทาง)</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>เส้นทาง</th>
                <th>ประเภท</th>
                <th className="num">ขา/รอบ</th>
                <th className="num">จำนวนเที่ยว</th>
                <th className="num">ระยะทางเฉลี่ย</th>
                <th className="num">มาตรฐาน (ย้อนหลัง)</th>
                <th className="num">ส่วนต่าง</th>
                <th className="num">KM/L เฉลี่ย</th>
                <th className="num">มาตรฐาน (ย้อนหลัง)</th>
                <th className="num">ส่วนต่าง</th>
                <th className="num">ผิดปกติ</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(r => (
                <tr key={r.key}>
                  <td>{r.routeLabel}</td>
                  <td>
                    <span className={`badge ${r.kind === 'deadhead' ? 'amber' : 'green'}`} style={{ fontSize: 11 }}>
                      {r.kind === 'deadhead' ? 'ตีเปล่า' : 'มีสินค้า'}
                    </span>
                  </td>
                  <td className="num muted">{r.legCount}</td>
                  <td className="num">{r.count}</td>
                  <td className="num">{db.fmt(r.avgDistance)}</td>
                  <td className="num muted">{r.sampleOk && r.base ? db.fmt(r.base.meanDistance) : `น้อยกว่า ${ROUTE_MIN_SAMPLES} เที่ยว`}</td>
                  <td className="num" style={{ color: r.distancePct != null && r.distancePct > ROUTE_ANOMALY_PCT ? 'var(--red)' : undefined, fontWeight: r.distancePct != null && r.distancePct > ROUTE_ANOMALY_PCT ? 600 : undefined }}>
                    {pctText(r.distancePct)}
                  </td>
                  <td className="num">{r.avgKmPerL != null ? r.avgKmPerL.toFixed(2) : '—'}</td>
                  <td className="num muted">{r.sampleOk && r.base?.meanKmPerL != null ? r.base.meanKmPerL.toFixed(2) : '—'}</td>
                  <td className="num" style={{ color: r.fuelPct != null && r.fuelPct < -ROUTE_ANOMALY_PCT ? 'var(--red)' : undefined, fontWeight: r.fuelPct != null && r.fuelPct < -ROUTE_ANOMALY_PCT ? 600 : undefined }}>
                    {pctText(r.fuelPct)}
                  </td>
                  <td className="num">
                    {r.anomalyCount > 0
                      ? <span className="badge" style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 11 }}>{r.anomalyCount} ⚠️</span>
                      : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {summaryRows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 36, color: 'var(--text-2)' }}>
                    ไม่พบเที่ยวในช่วงเวลาที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flagged trips */}
      <div className="card">
        <div className="head">
          <h3>เที่ยวผิดปกติ ({flaggedTrips.length} เที่ยว)</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>วันที่</th>
                <th>เส้นทาง</th>
                <th>ประเภท</th>
                <th className="num">ขา/รอบ</th>
                <th>รถ</th>
                <th>คนขับ</th>
                <th className="num">ระยะทาง</th>
                <th className="num">KM/L</th>
                <th>ปัญหา</th>
              </tr>
            </thead>
            <tbody>
              {flaggedTrips.map(({ trip, flags }) => (
                <tr
                  key={trip.round.id}
                  style={{ cursor: 'pointer', background: '#FEE2E2' }}
                  onClick={() => {
                    setSubject({ type: 'round', id: trip.round.id, origin: 'routeAnalysis.trips' })
                    setActive('dispatch.round')
                  }}
                >
                  <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{trip.round.code}</td>
                  <td className="num muted">{trip.date}</td>
                  <td>{trip.routeLabel}</td>
                  <td>
                    <span className={`badge ${trip.kind === 'deadhead' ? 'amber' : 'green'}`} style={{ fontSize: 11 }}>
                      {trip.kind === 'deadhead' ? 'ตีเปล่า' : 'มีสินค้า'}
                    </span>
                  </td>
                  <td className="num muted">{trip.legCount}</td>
                  <td className="mono">{trip.vehicle?.plate ?? '—'}</td>
                  <td>{trip.driver?.name ?? '—'}</td>
                  <td className="num">{db.fmt(trip.distance)} {flags.distanceFlag && <span title={`เกินค่าเฉลี่ย ${pctText(flags.distancePct)}`}>⚠️</span>}</td>
                  <td className="num">{trip.kmPerL != null ? trip.kmPerL.toFixed(2) : '—'} {flags.fuelFlag && <span title={`ต่ำกว่าค่าเฉลี่ย ${pctText(flags.fuelPct)}`}>⚠️</span>}</td>
                  <td style={{ fontSize: 12 }}>
                    {flags.distanceFlag && <span className="badge" style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 11, marginRight: 4 }}>ระยะทางเกิน {pctText(flags.distancePct)}</span>}
                    {flags.fuelFlag && <span className="badge" style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 11 }}>น้ำมันเกิน {pctText(flags.fuelPct)}</span>}
                  </td>
                </tr>
              ))}
              {flaggedTrips.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 36, color: 'var(--text-2)' }}>
                    ไม่พบเที่ยวผิดปกติในช่วงเวลาที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
