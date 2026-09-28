import { useMemo } from 'react'
import { db, ROUTE_ANOMALY_PCT, ROUTE_MIN_SAMPLES } from '../lib/db'
import { useList } from './useTable'
import { useDispatches } from './useDispatches'
import type { Vehicle, Employee, Dispatch, Location, FuelRound } from '../types'

export interface RouteTripRow {
  round: Dispatch
  /** ลำดับสถานที่ที่ผ่านจริงในรอบนี้ เช่น ['KPS','สันกอก','KPS'] — ไม่ยุบเหลือแค่ต้นทาง/ปลายทางสุดท้าย */
  stops: string[]
  /** ป้ายแสดงผล: stops คั่นด้วย " → " */
  routeLabel: string
  /** จำนวนขาในรอบ — รวมเป็นส่วนหนึ่งของ key เพื่อไม่ให้รอบที่แวะหลายจุดปนกับรอบวิ่งตรง */
  legCount: number
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

// เทียบแบบไม่สนช่องว่างหัวท้าย/ตัวพิมพ์ — ให้ตรงกับตรรกะเช็คซ้ำใน LocationCombobox
function normKey(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

export function routeGroupKey(routeKey: string, legCount: number, kind: string): string {
  return `${routeKey}|legs=${legCount}|${kind}`
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
  const { data: locations = [] } = useList<Location>('locations')

  // ต้นทาง/ปลายทางเป็นข้อความอิสระ (พิมพ์เอง หรือเลือกจาก datalist ของทะเบียนสถานที่)
  // "ปัก" ชื่อให้อ้างอิงทะเบียนสถานที่เดียวกันเสมอ กันกรณีเผลอพิมพ์เว้นวรรค/ตัวพิมพ์
  // ต่างกันจนระบบมองว่าเป็นคนละที่ — ถ้าไม่พบในทะเบียนจะ fallback เป็นชื่อที่พิมพ์ (ตัดช่องว่างหัวท้าย)
  const canonicalize = useMemo(() => {
    const map = new Map<string, string>()
    locations.forEach(l => {
      const key = normKey(l.name)
      if (key) map.set(key, l.name)
    })
    return (raw: string): string => {
      const trimmed = (raw ?? '').trim()
      if (!trimmed) return ''
      return map.get(normKey(trimmed)) ?? trimmed
    }
  }, [locations])

  const trips = useMemo<RouteTripRow[]>(() => {
    return dispatch
      .filter(d => d.roundStatus === 'closed' || d.status === 'completed')
      .map((round): RouteTripRow => {
        const legs = db.legsOf(round)
        // ลำดับสถานที่จริงที่ผ่านในรอบนี้ (ไม่ยุบเหลือแค่ต้นทาง/ปลายทางสุดท้าย — รอบไป-กลับ
        // กลับมาจุดเดิมจะทำให้จุดแวะระหว่างทาง เช่น "สันกอก" หายไปถ้าดูแค่ต้นทาง-ปลายทางรวม)
        const stops: string[] = []
        legs.forEach((l, i) => {
          if (i === 0) {
            const o = canonicalize(l.origin)
            if (o) stops.push(o)
          }
          const d = canonicalize(l.destination)
          if (d && stops[stops.length - 1] !== d) stops.push(d)
        })
        if (stops.length === 0) stops.push('—')

        const fuelRound = db.fuelRoundOfDispatch(round.id, fuelRounds)
        const consumed = fuelRound ? db.fuelRoundConsumed(fuelRound) : (round.liters || 0)
        const distance = db.roundDistance(round)
        const kmPerL = consumed > 0 && distance > 0 ? distance / consumed : null
        return {
          round,
          stops,
          routeLabel: stops.join(' → '),
          legCount: legs.length,
          kind: kindOf(round),
          vehicle: vehicles.find(v => v.id === round.vehicleId),
          driver: employees.find(e => e.id === round.driverId),
          date: (round.depart || round.date || '').slice(0, 10),
          distance,
          kmPerL,
        }
      })
      .filter(t => t.distance > 0)
  }, [dispatch, fuelRounds, vehicles, employees, canonicalize])

  const baselineMap = useMemo(() => {
    const groups = new Map<string, RouteTripRow[]>()
    trips.forEach(t => {
      const k = routeGroupKey(t.routeLabel, t.legCount, t.kind)
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

  const baselineOf = (t: RouteTripRow) => baselineMap.get(routeGroupKey(t.routeLabel, t.legCount, t.kind))

  return { trips, baselineMap, baselineOf }
}
