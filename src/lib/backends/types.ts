// Shared contract for a data backend. Both the Supabase and the MySQL/REST
// implementations satisfy this interface, so the rest of the app (crud.ts,
// useTable.ts, ~60 pages) is agnostic to which one is active.
export interface DataBackend {
  listAll<T>(table: string, orderBy?: string, ascending?: boolean): Promise<T[]>
  getOne<T>(table: string, id: string): Promise<T | null>
  insertOne<T>(table: string, row: Partial<T>): Promise<T>
  updateOne<T>(table: string, id: string, patch: Partial<T>): Promise<T>
  deleteOne(table: string, id: string): Promise<void>
  callRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>
}

// Build-time backend selector. Vite statically replaces import.meta.env.* so
// this resolves to a constant string in the bundle.
export type BackendName = 'supabase' | 'mysql'
export const ACTIVE_BACKEND: BackendName =
  (import.meta.env.VITE_DATA_BACKEND as BackendName) || 'supabase'
