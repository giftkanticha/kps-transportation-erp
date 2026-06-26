import { Prisma } from '@prisma/client'

// Registry of tables exposed through the generic /api/data router. Built from
// the Prisma DMMF so it always stays in sync with schema.prisma — no manual
// list to drift. This registry IS the security boundary that replaces Supabase
// row-level security: only whitelisted tables are reachable, and only their
// known columns can be written (mass-assignment protection).

// Auth/credential tables are deliberately NOT exposed generically — they are
// served by the dedicated /api/auth, /api/acl and /api/reset routes.
const EXCLUDED_TABLES = new Set([
  'User', 'LoginHistory', 'PasswordReset', 'RolePermission', 'AuditLog', 'DataResetLog',
  'user_profiles', 'user_permissions', 'acl_audit_log',
])

export interface TableConfig {
  table: string                       // public (snake_case) table name
  delegate: string                    // Prisma client delegate, e.g. 'fuelRecord'
  colToField: Map<string, string>     // db column -> Prisma field name
  fieldToCol: Map<string, string>     // Prisma field -> db column name
  writableCols: Set<string>           // db columns a client may set on insert/update
  hasCreatedAt: boolean
}

function buildRegistry(): Map<string, TableConfig> {
  const reg = new Map<string, TableConfig>()
  // Prisma.dmmf is populated from whichever schema generated the client. For
  // the self-hosted MySQL deployment that is schema.mysql.prisma (~38 tables).
  const models = (Prisma as any).dmmf?.datamodel?.models ?? []

  for (const m of models) {
    const table = m.dbName ?? m.name
    if (EXCLUDED_TABLES.has(table) || EXCLUDED_TABLES.has(m.name)) continue

    const delegate = m.name.charAt(0).toLowerCase() + m.name.slice(1)
    const colToField = new Map<string, string>()
    const fieldToCol = new Map<string, string>()
    const writableCols = new Set<string>()
    let hasCreatedAt = false

    for (const f of m.fields) {
      // Skip relation/object fields — only scalar/enum columns are addressable.
      if (f.kind === 'object') continue
      const col = f.dbName ?? f.name
      colToField.set(col, f.name)
      fieldToCol.set(f.name, col)
      if (col === 'created_at') hasCreatedAt = true
      // Server owns id and timestamps; everything else is client-writable.
      const serverOwned = f.isId || f.isUpdatedAt || col === 'created_at' || col === 'updated_at'
      if (!serverOwned) writableCols.add(col)
    }

    reg.set(table, { table, delegate, colToField, fieldToCol, writableCols, hasCreatedAt })
  }
  return reg
}

const registry = buildRegistry()

export function getTableConfig(table: string): TableConfig | null {
  return registry.get(table) ?? null
}

// Convert a snake_case row coming from the client into Prisma input keyed by
// field name, keeping only writable columns (mass-assignment guard). JSON
// column values are passed through untouched (no nested key transform).
export function toPrismaInput(cfg: TableConfig, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [col, value] of Object.entries(body)) {
    if (!cfg.writableCols.has(col)) continue
    const field = cfg.colToField.get(col)
    if (!field) continue
    out[field] = value
  }
  return out
}

// Convert a Prisma row (field-named, camelCase) back into the snake_case wire
// shape the frontend expects (it then runs its own snakeToCamel).
export function toWireRow(cfg: TableConfig, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(row)) {
    out[cfg.fieldToCol.get(field) ?? field] = value
  }
  return out
}

// Map a snake_case orderBy column from the client to its Prisma field name.
export function orderField(cfg: TableConfig, column: string): string | null {
  return cfg.colToField.get(column) ?? null
}
