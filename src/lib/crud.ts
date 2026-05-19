import { supabase } from './supabase'
import { snakeToCamel, camelToSnake } from './caseTransform'

export async function listAll<T>(table: string, orderBy = 'created_at', ascending = false): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending })
  if (error) throw error
  return (data ?? []).map((r) => snakeToCamel<T>(r))
}

export async function getOne<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? snakeToCamel<T>(data) : null
}

export async function insertOne<T>(table: string, row: Partial<T>): Promise<T> {
  const payload = camelToSnake<Record<string, unknown>>(row)
  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) throw error
  return snakeToCamel<T>(data)
}

export async function updateOne<T>(table: string, id: string, patch: Partial<T>): Promise<T> {
  const payload = camelToSnake<Record<string, unknown>>(patch)
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single()
  if (error) throw error
  return snakeToCamel<T>(data)
}

export async function deleteOne(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
