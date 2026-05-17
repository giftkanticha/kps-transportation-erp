import type {
  AppState,
  User,
  Dispatch,
  DispatchLeg,
} from '../types'
import { SEED } from '../data/seed'

// ─── Constants ────────────────────────────────────────────────────────────────

const KEY = 'kps_erp_v5'
const SESSION_KEY = KEY + '_session'

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

  nameOf(table: keyof AppState, id: string): string {
    const r = db.get<Record<string, string>>(table, id)
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

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset(): AppState {
    localStorage.removeItem(KEY)
    localStorage.removeItem(SESSION_KEY)
    return init(true)
  },
}

// Initialise on import
init()
