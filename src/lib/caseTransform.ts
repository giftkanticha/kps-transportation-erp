type Json = unknown

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())

// Postgres `numeric` columns are returned as strings by PostgREST to preserve
// precision. The app types them as `number`, and code does arithmetic on them
// (e.g. sum + balance), so without coercion `0 + "5000" + "3000"` becomes the
// string "050003000". Coerce these known numeric fields back to numbers on read.
const NUMERIC_FIELDS = new Set([
  'accumulatedKm', 'amount', 'balance', 'cost', 'deliveredWeight', 'distance',
  'endOdometer', 'finalWeight', 'fuel', 'installedOdometer', 'kmPerL', 'liters',
  'monthly', 'nextMileage', 'nextServiceKm', 'odometer', 'openInvoice', 'perDiem',
  'price', 'pricePerL', 'qty', 'qtyIn', 'qtyOut', 'rating', 'reorderAt', 'revenue',
  'salary', 'sellPrice', 'startOdometer', 'tankCapacity', 'total', 'totalAmount',
  'totalPaid', 'unitCost', 'unitPrice', 'weight',
])

function transformKeys(input: Json, fn: (key: string) => string, coerceNumeric: boolean): Json {
  if (Array.isArray(input)) return input.map((v) => transformKeys(v, fn, coerceNumeric))
  if (input && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype) {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(input as Record<string, Json>)) {
      const key = fn(k)
      let value = transformKeys(v, fn, coerceNumeric)
      // Only coerce non-empty string values; leave null/undefined untouched so
      // "not set" semantics (e.g. sellPrice == null) survive the round trip.
      if (coerceNumeric && typeof value === 'string' && value !== '' && NUMERIC_FIELDS.has(key)) {
        const n = Number(value)
        if (!Number.isNaN(n)) value = n
      }
      out[key] = value
    }
    return out
  }
  return input
}

export const snakeToCamel = <T = unknown>(row: unknown): T => transformKeys(row, toCamel, true) as T
export const camelToSnake = <T = unknown>(row: unknown): T => transformKeys(row, toSnake, false) as T
