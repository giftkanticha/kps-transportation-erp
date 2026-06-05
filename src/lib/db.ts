import type {
  AppState,
  User,
  Dispatch,
  DispatchLeg,
  FuelRound,
  Route,
} from '../types'
import { SEED } from '../data/seed'

// ─── Constants ────────────────────────────────────────────────────────────────

const KEY = 'kps_erp_v6'
const SESSION_KEY = KEY + '_session'

export const DSP_KMPL_THRESHOLD = 2.5
export const DEFAULT_TANK_CAPACITY = 500
export const HOME_BASE = 'โรงงาน KPS'

// ─── Internal helpers ─────────────────────────────────────────────────────────

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppState
  } catch {
    return null
  }
}

function save(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function init(force?: boolean): AppState {
  if (force || !load()) save(SEED)
  return load()!
}

export function uid(prefix: string = 'r'): string {
  return prefix + Math.random().toString(36).slice(2, 8)
}

// ─── Public db object ─────────────────────────────────────────────────────────

export const db = {
  // ── Auth ──────────────────────────────────────────────────────────────────

  login(email: string): User | null {
    const users = db.getAll<User>('users')
    const u = users.find(
      (x) => x.email.toLowerCase() === String(email ?? '').trim().toLowerCase(),
    )
    if (u) {
      localStorage.setItem(SESSION_KEY, u.id)
      return u
    }
    return null
  },

  logout(): void {
    localStorage.removeItem(SESSION_KEY)
  },

  currentUser(): User | null {
    const sid = localStorage.getItem(SESSION_KEY)
    if (!sid) return null
    return db.get<User>('users', sid) ?? null
  },

  // ── CRUD ──────────────────────────────────────────────────────────────────

  getAll<T>(table: keyof AppState): T[] {
    const s = load() ?? init()
    return (s[table] as unknown as T[]) ?? []
  },

  get<T>(table: keyof AppState, id: string): T | undefined {
    return db.getAll<T>(table).find((r) => (r as { id: string }).id === id)
  },

  add<T extends { id?: string }>(table: keyof AppState, row: T): T {
    const s = load() ?? init()
    if (!row.id) row = { ...row, id: uid(table[0]) }
    ;(s[table] as unknown[]) = [row, ...((s[table] as unknown[]) ?? [])]
    save(s)
    return row
  },

  update<T>(table: keyof AppState, id: string, patch: Partial<T>): T {
    const s = load() ?? init()
    ;(s[table] as unknown[]) = (s[table] as unknown[]).map((r) =>
      (r as { id: string }).id === id ? { ...(r as object), ...(patch as object) } : r,
    )
    save(s)
    return db.get<T>(table, id) as T
  },

  remove(table: keyof AppState, id: string): void {
    const s = load() ?? init()
    ;(s[table] as unknown[]) = (s[table] as unknown[]).filter(
      (r) => (r as { id: string }).id !== id,
    )
    save(s)
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  nameOf(table: keyof AppState, id: string, rows?: Array<Record<string, string>>): string {
    const r = rows ? rows.find((x) => (x as { id: string }).id === id) : db.get<Record<string, string>>(table, id)
    if (!r) return '—'
    return r['name'] ?? r['plate'] ?? r['code'] ?? id
  },

  fmt(n: number | null | undefined): string {
    if (n === 0) return '0'
    if (n === null || n === undefined) return '—'
    return new Intl.NumberFormat('en-US').format(Math.round(n))
  },

  thb(n: number | null | undefined): string {
    return '฿' + db.fmt(n)
  },

  thaiDate(s: string): string {
    if (!s) return '—'
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
  },

  legsOf(t: Dispatch): DispatchLeg[] {
    if (t.legs && t.legs.length) return t.legs
    return [
      {
        origin: '',
        destination: '',
        cargo: '',
        cargoType: '',
        priceMode: 'lump',
        weight: 0,
        price: t.revenue ?? 0,
        amount: t.revenue ?? 0,
      },
    ]
  },

  originOf(t: Dispatch): string {
    return db.legsOf(t)[0]?.origin ?? ''
  },

  destOf(t: Dispatch): string {
    const legs = db.legsOf(t)
    return legs[legs.length - 1]?.destination ?? ''
  },

  amountOf(t: Dispatch): number {
    if (typeof t.totalAmount === 'number') return t.totalAmount
    return db.legsOf(t).reduce((sum, l) => sum + (l.amount ?? 0), 0) || t.revenue || 0
  },

  legAmount(leg: DispatchLeg): number {
    if (!leg) return 0
    const w = +(leg.weight ?? 0)
    const p = +(leg.price ?? 0)
    if (leg.priceMode === 'per_kg') return w * 1000 * p
    if (leg.priceMode === 'per_ton') return w * p
    return p // lump
  },

  // Find a route master row whose origin+destination match the given pair
  // (case-insensitive, trimmed). Used to auto-group historical legs that
  // pre-date the routeId FK so reports can still aggregate them under a route.
  findRouteByOriginDestination(origin: string, destination: string, routes: Route[]): Route | null {
    const o = (origin ?? '').trim().toLowerCase()
    const d = (destination ?? '').trim().toLowerCase()
    if (!o || !d) return null
    return routes.find(r =>
      r.origin.trim().toLowerCase() === o &&
      r.destination.trim().toLowerCase() === d,
    ) ?? null
  },

  resolveRouteId(leg: DispatchLeg, routes: Route[]): string | null {
    if (leg.routeId) return leg.routeId
    return db.findRouteByOriginDestination(leg.origin, leg.destination, routes)?.id ?? null
  },

  // ── Round helpers ─────────────────────────────────────────────────────────

  lastClosedMileage(vehicleId: string, dispatches?: Dispatch[]): number | null {
    if (!vehicleId) return null
    const rounds = (dispatches ?? db.getAll<Dispatch>('dispatch'))
      .filter(d =>
        d.vehicleId === vehicleId
        && (d.roundStatus === 'closed' || d.status === 'completed')
        && d.endOdometer != null,
      )
    if (!rounds.length) return null
    return Math.max(...rounds.map(d => d.endOdometer ?? 0))
  },

  nextRoundCode(dispatches?: Dispatch[]): string {
    const today = new Date()
    const ymd =
      today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0')
    const prefix = `DSP-${ymd}-`
    const todays = (dispatches ?? db.getAll<Dispatch>('dispatch')).filter(d => d.code?.startsWith(prefix))
    // Use the largest existing sequence + 1, not length + 1 — if any of
    // today's rounds was deleted, length leaves a gap and the same code
    // would clash with another live row on the next insert.
    const maxSeq = todays.reduce((max, d) => {
      const n = parseInt(d.code.slice(prefix.length), 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    return prefix + String(maxSeq + 1).padStart(3, '0')
  },

  roundRevenue(d: Dispatch): number {
    return (d.legs ?? []).reduce((s, l) => s + (l.amount || 0), 0)
  },

  roundPerDiem(d: Dispatch): number {
    return (d.legs ?? []).reduce((s, l) => s + (l.perDiem || 0), 0)
  },

  roundOtherExpenses(d: Dispatch): number {
    return (d.otherExpenses ?? []).reduce((s, e) => s + (e.amount || 0), 0)
  },

  roundDistance(d: Dispatch): number {
    if (d.startOdometer == null || d.endOdometer == null) return 0
    return Math.max(0, d.endOdometer - d.startOdometer)
  },

  // ── Fuel round helpers ────────────────────────────────────────────────────

  nextFuelRoundCode(rounds?: FuelRound[]): string {
    const today = new Date()
    const ymd =
      today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0')
    const prefix = `RUND-${ymd}-`
    const todays = (rounds ?? db.getAll<FuelRound>('fuelRounds')).filter(r => r.code?.startsWith(prefix))
    const maxSeq = todays.reduce((max, r) => {
      const n = parseInt(r.code.slice(prefix.length), 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    return prefix + String(maxSeq + 1).padStart(3, '0')
  },

  activeFuelRoundForVehicle(vehicleId: string, rounds?: FuelRound[]): FuelRound | null {
    if (!vehicleId) return null
    return (rounds ?? db.getAll<FuelRound>('fuelRounds'))
      .find(r => r.vehicleId === vehicleId && r.status === 'open') ?? null
  },

  fuelRoundOfDispatch(dispatchRoundId: string, rounds?: FuelRound[]): FuelRound | null {
    if (!dispatchRoundId) return null
    return (rounds ?? db.getAll<FuelRound>('fuelRounds'))
      .find(r => r.dispatchRoundId === dispatchRoundId) ?? null
  },

  fuelRoundStartLiters(r: FuelRound): number {
    return r.refills.find(x => x.type === 'start')?.liters ?? 0
  },

  fuelRoundIntermediateTotal(r: FuelRound): number {
    return r.refills.filter(x => x.type === 'intermediate').reduce((s, x) => s + x.liters, 0)
  },

  fuelRoundEndLiters(r: FuelRound): number {
    return r.refills.find(x => x.type === 'end')?.liters ?? 0
  },

  // Current tank level (only meaningful for open rounds, before close)
  fuelRoundCurrentLevel(r: FuelRound): number {
    // We assume tank is full at start. Each refill brings tank back toward full.
    // For UI estimation, we don't know real-time consumption, so we estimate
    // by assuming the truck always uses fuel that's currently in the tank.
    // Simplest approximation: level after intermediates = capacity (since
    // intermediates are usually only done when tank is low enough to need fuel).
    // But we want to show a useful level for the refill UI's "available capacity".
    // We'll show capacity - intermediate liters added (assuming each intermediate
    // brings level partway back). This is an estimate.
    const cap = r.tankCapacity || DEFAULT_TANK_CAPACITY
    // Estimate consumption between refills: assume each refill brought tank to full,
    // so level right before each refill = cap - refill.liters. After refill = cap.
    // After most recent refill, level = cap. This is the simplest model.
    if (!r.refills.length) return cap
    return cap // assume always brought to full
  },

  fuelRoundConsumed(r: FuelRound): number {
    // Consumed = intermediates + end-fill (when tank starts and ends at full)
    if (r.status !== 'closed') return 0
    return db.fuelRoundIntermediateTotal(r) + db.fuelRoundEndLiters(r)
  },

  fuelRoundCost(r: FuelRound): number {
    // Cost of fuel purchased during this round = all refills EXCEPT start
    return r.refills
      .filter(x => x.type !== 'start')
      .reduce((s, x) => s + (x.cost || 0), 0)
  },

  fuelRoundDistance(r: FuelRound): number {
    const start = r.refills.find(x => x.type === 'start')?.mileage ?? 0
    const end = r.refills.find(x => x.type === 'end')?.mileage ?? 0
    return Math.max(0, end - start)
  },

  fuelRoundEfficiency(r: FuelRound): number | null {
    const consumed = db.fuelRoundConsumed(r)
    const dist = db.fuelRoundDistance(r)
    if (!consumed || !dist) return null
    return dist / consumed
  },

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset(): AppState {
    localStorage.removeItem(KEY)
    localStorage.removeItem(SESSION_KEY)
    return init(true)
  },
}

// Initialise on import
init()
