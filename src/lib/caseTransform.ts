type Json = unknown

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())

function transformKeys(input: Json, fn: (key: string) => string): Json {
  if (Array.isArray(input)) return input.map((v) => transformKeys(v, fn))
  if (input && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype) {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(input as Record<string, Json>)) {
      out[fn(k)] = transformKeys(v, fn)
    }
    return out
  }
  return input
}

export const snakeToCamel = <T = unknown>(row: unknown): T => transformKeys(row, toCamel) as T
export const camelToSnake = <T = unknown>(row: unknown): T => transformKeys(row, toSnake) as T
