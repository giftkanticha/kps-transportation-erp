import 'dotenv/config'
import { prisma } from './lib/prisma'
import { listTables, type TableConfig } from './lib/tables'

// One-off data migration: copy every operational table from the existing
// Supabase (PostgREST) project into the self-hosted MySQL database, PRESERVING
// the original UUID primary keys so all cross-table references stay intact.
//
// It does NOT touch users/passwords (those live in Supabase Auth and cannot be
// exported; users re-register or get a password reset on the new system) and it
// does NOT delete anything from Supabase — it only reads.
//
// Usage (from server/, after the MySQL schema is pushed):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_KEY=<service-role-key> \
//   DATABASE_URL=mysql://... \
//   npx tsx src/migrate-from-supabase.ts
//
// A service-role key is recommended so row-level security doesn't hide rows.

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
const PAGE = 1000

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY).')
  process.exit(1)
}

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SUPABASE_KEY as string,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        'Range-Unit': 'items',
      },
    })
    if (res.status === 404) { console.warn(`  (table ${table} not found in Supabase — skipping)`); return rows }
    if (!res.ok) throw new Error(`fetch ${table} failed: ${res.status} ${await res.text()}`)
    const batch = (await res.json()) as Record<string, unknown>[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

// Convert a snake_case Supabase row into Prisma-input keyed by field name,
// keeping the id and timestamps so values are preserved exactly.
function toPrisma(cfg: TableConfig, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [col, value] of Object.entries(row)) {
    const field = cfg.colToField.get(col)
    if (field) out[field] = value
  }
  return out
}

async function main() {
  const tables = listTables()
  if (tables.length === 0) {
    console.error('No tables in registry — generate the Prisma client from schema.mysql.prisma first.')
    process.exit(1)
  }

  console.log(`Migrating ${tables.length} tables from ${SUPABASE_URL} → MySQL`)
  for (const cfg of tables) {
    process.stdout.write(`• ${cfg.table} ... `)
    let rows: Record<string, unknown>[]
    try {
      rows = await fetchAll(cfg.table)
    } catch (e) {
      console.log(`ERROR reading: ${(e as Error).message}`)
      continue
    }
    if (rows.length === 0) { console.log('0 rows'); continue }

    const data = rows.map((r) => toPrisma(cfg, r))
    const delegate = (prisma as any)[cfg.delegate]
    try {
      // createMany is fast and skipDuplicates makes re-runs idempotent.
      const result = await delegate.createMany({ data, skipDuplicates: true })
      console.log(`${result.count}/${rows.length} inserted`)
    } catch (e) {
      // Fall back to row-by-row so one bad row doesn't abort the whole table.
      let ok = 0
      for (const d of data) {
        try { await delegate.create({ data: d }); ok++ } catch { /* skip bad row */ }
      }
      console.log(`${ok}/${rows.length} inserted (row-by-row; some skipped: ${(e as Error).message})`)
    }
  }
  console.log('Done. Verify row counts, then point the app at MySQL.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
