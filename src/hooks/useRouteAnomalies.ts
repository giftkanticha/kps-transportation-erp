import { useMemo } from 'react'
import { db, ROUTE_ANOMALY_PCT, ROUTE_MIN_SAMPLES } from '../lib/db'
import { useList } from './useTable'
import { useDispatches } from './useDispatches'
import type { Vehicle, Employee, Dispatch, FuelRound } from '../types'

export interface RouteTripRow {
  round: Dispatch
  routeKey: string
  origin: string
  destination: string
  kind: 'loaded' | 'deadhead'
  vehicle?: Vehicle
  driver?: Employee
  date: string
  distance: number
  kmPerL: number | null
}

export interface RouteBaseline {
  n: number
  meanDistance: number
  meanKmPerL: number | null
  nKmPerL: number
}

export interface RouteTripFlags {
  distancePct: number | null
  distanceFlag: boolean
  fuelPct: number | null
  fuelFlag: boolean
  anomaly: boolean
  sampleOk: boolean
}

export function routeGroupKey(routeKey: string, kind: string): string {
  return `${routeKey}|${kind}`
}

// เที่ยวไม่มีสินค้า/ตีเปล่า = ทุกขาไม่วางบิล (noBill) หรือรอบไม่มีรายได้เลย
function kindOf(round: Dispatch): 'loaded' | 'deadhead' {
  const legs = round.legs ?? []
  if (legs.length > 0 && legs.every(l => l.noBill)) return 'deadhead'
  return db.roundRevenue(round) > 0 ? 'loaded' : 'deadhead'
}

export function routeTripFlags(t: RouteTripRow, base?: RouteBaseline): RouteTripFlags {
  const sampleOk = !!base && base.n >= ROUTE_MIN_SAMPLES
  const distancePct = sampleOk && base ? (t.distance - base.meanDistance) / base.meanDistance : null
  const distanceFlag = sampleOk && distancePct != null && distancePct > ROUTE_ANOMALY_PCT
  const fuelSampleOk = !!base && base.nKmPerL >= ROUTE_MIN_SAMPLES && base.meanKmPerL != null
  const fuelPct = fuelSampleOk && base?.meanKmPerL && t.kmPerL != null
    ? (t.kmPerL - base.meanKmPerL) / base.meanKmPerL
    : null
  const fuelFlag = fuelSampleOk && fuelPct != null && fuelPct < -ROUTE_ANOMALY_PCT
  return { distancePct, distanceFlag, fuelPct, fuelFlag, anomaly: distanceFlag || fuelFlag, sampleOk }
}

// เที่ยวทั้งหมดที่ปิดรอบแล้ว/เสร็จแล้ว + ค่าเฉลี่ยมาตรฐานต่อเส้นทาง+ประเภท (ตีเปล่า/มีสินค้า
// แยกกัน) คำนวณจากเที่ยวย้อนหลังทั้งหมด — ใช้ร่วมกันโดยหน้ารายงานและการ์ดแจ้งเตือน
export function useRouteAnomalies() {
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatch = [] } = useDispatches()
  const { data: fuelRounds = [] } = useList<FuelRound>('fuel_rounds')

  const trips = useMemo<RouteTripRow[]>(() => {
    return dispatch
      .filter(d => d.roundStatus === 'closed' || d.status === 'completed')
      .map((round): RouteTripRow => {
        const origin = db.originOf(round) || '—'
        const destination = db.destOf(round) || '—'
        const fuelRound = db.fuelRoundOfDispatch(round.id, fuelRounds)
        const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (round.liters || 0)
        const distance = db.roundDistance(round)
        const kmPerL = consumed > 0 && distance > 0 ? distance / consumed : null
        return {
          round,
          routeKey: `${origin} → ${destination}`,
          origin,
          destination,
          kind: kindOf(round),
          vehicle: vehicles.find(v => v.id === round.vehicleId),
          driver: employees.find(e => e.id === round.driverId),
          date: (round.depart || round.date || '').slice(0, 10),
          distance,
          kmPerL,
        }
      })
      .filter(t => t.distance > 0)
  }, [dispatch, fuelRounds, vehicles, employees])

  const baselineMap = useMemo(() => {
    const groups = new Map<string, RouteTripRow[]>()
    trips.forEach(t => {
      const k = routeGroupKey(t.routeKey, t.kind)
      const arr = groups.get(k) ?? []
      arr.push(t)
      groups.set(k, arr)
    })
    const map = new Map<string, RouteBaseline>()
    groups.forEach((group, k) => {
      const n = group.length
      const meanDistance = group.reduce((s, t) => s + t.distance, 0) / n
      const withFuel = group.filter(t => t.kmPerL != null)
      const meanKmPerL = withFuel.length
        ? withFuel.reduce((s, t) => s + (t.kmPerL as number), 0) / withFuel.length
        : null
      map.set(k, { n, meanDistance, meanKmPerL, nKmPerL: withFuel.length })
    })
    return map
  }, [trips])

  const baselineOf = (t: RouteTripRow) => baselineMap.get(routeGroupKey(t.routeKey, t.kind))

  return { trips, baselineMap, baselineOf }
}
