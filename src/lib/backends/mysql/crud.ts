import { snakeToCamel, camelToSnake } from '../../caseTransform'
import { api } from './api'

// MySQL/REST implementation of the DataBackend contract. The wire format is
// kept identical to Supabase's PostgREST output (snake_case rows), so the
// snakeToCamel/camelToSnake transforms are applied exactly as in the Supabase
// backend and the pages see the same shapes — making this a drop-in swap.

export async function listAll<T>(table: string, orderBy = 'created_at', ascending = false): Promise<T[]> {
  const qs = `?orderBy=${encodeURIComponent(orderBy)}&ascending=${ascending}`
  const rows = await api<unknown[]>(`/api/data/${table}${qs}`)
  return (rows ?? []).map((r) => snakeToCamel<T>(r))
}

export async function getOne<T>(table: string, id: string): Promise<T | null> {
  const row = await api<unknown | null>(`/api/data/${table}/${id}`)
  return row ? snakeToCamel<T>(row) : null
}

export async function insertOne<T>(table: string, row: Partial<T>): Promise<T> {
  const payload = camelToSnake<Record<string, unknown>>(row)
  const created = await api<unknown>(`/api/data/${table}`, { method: 'POST', body: payload })
  return snakeToCamel<T>(created)
}

export async function updateOne<T>(table: string, id: string, patch: Partial<T>): Promise<T> {
  const payload = camelToSnake<Record<string, unknown>>(patch)
  const updated = await api<unknown>(`/api/data/${table}/${id}`, { method: 'PATCH', body: payload })
  return snakeToCamel<T>(updated)
}

export async function deleteOne(table: string, id: string): Promise<void> {
  await api<void>(`/api/data/${table}/${id}`, { method: 'DELETE' })
}

export async function callRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  return api<T>(`/api/rpc/${fn}`, { method: 'POST', body: args })
}
