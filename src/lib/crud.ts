import { supabase } from './supabase'
import { snakeToCamel, camelToSnake } from './caseTransform'

// Supabase returns a PostgrestError ({ code, message, details, hint }) which is
// a plain object — `error instanceof Error` is false and the default toString
// gives '[object Object]'. Wrap each error as a real Error so callers can show
// the actual message (including hint) instead of '[object Object]'.
function toError(error: { message?: string; details?: string; hint?: string; code?: string }): Error {
  const parts = [error.message, error.details, error.hint].filter(Boolean)
  const msg = parts.length > 0 ? parts.join(' · ') : (error.code ?? 'database error')
  const wrapped = new Error(msg)
  // Preserve the original fields for callers that want to inspect them.
  Object.assign(wrapped, { code: error.code, details: error.details, hint: error.hint })
  return wrapped
}

// PostgREST caps a single response at its configured `max-rows` (default 1000).
// Without pagination every full-table read (fuel ledgers, dispatch history, …)
// silently truncates once a table passes that many rows, which quietly
// overstates balances and defeats "insufficient stock" guards. Page through
// with .range() until a short page is returned.
const PAGE_SIZE = 1000

export async function listAll<T>(table: string, orderBy = 'created_at', ascending = false): Promise<T[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw toError(error)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows.map((r) => snakeToCamel<T>(r))
}

export async function getOne<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw toError(error)
  return data ? snakeToCamel<T>(data) : null
}

export async function insertOne<T>(table: string, row: Partial<T>): Promise<T> {
  const payload = camelToSnake<Record<string, unknown>>(row)
  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) throw toError(error)
  return snakeToCamel<T>(data)
}

export async function updateOne<T>(table: string, id: string, patch: Partial<T>): Promise<T> {
  const payload = camelToSnake<Record<string, unknown>>(patch)
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single()
  if (error) throw toError(error)
  return snakeToCamel<T>(data)
}

export async function deleteOne(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw toError(error)
}

export async function callRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toError(error)
  return data as T
}
