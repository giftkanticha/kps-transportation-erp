import 'dotenv/config'
import bcrypt from 'bcrypt'
import { Client } from 'pg'
import { prisma } from './lib/prisma'

// Migrate user ACCOUNTS (incl. password hashes) from Supabase Auth into the
// self-hosted MySQL `User` table — so existing users keep their CURRENT
// passwords, no reset needed.
//
// Why a separate script (not migrate-from-supabase.ts): passwords live in the
// `auth.users` table, which the Supabase REST API (PostgREST) does NOT expose —
// it only sees the `public` schema. So this connects DIRECTLY to Supabase's
// Postgres using the database connection string, reads `auth.users`
// (`encrypted_password` is a bcrypt hash, identical format to what this server
// uses), and copies it straight into `User.passwordHash`.
//
// Usage (from server/, after the MySQL schema is pushed):
//   SUPABASE_DB_URL="postgresql://postgres:[DB-PASSWORD]@db.xxxx.supabase.co:5432/postgres" \
//   DATABASE_URL="mysql://..." \
//   npx tsx src/migrate-users-from-supabase.ts
//
// Get SUPABASE_DB_URL from: Supabase dashboard → Project Settings → Database →
// Connection string (URI). It needs the database password.

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL
if (!SUPABASE_DB_URL) {
  console.error('Set SUPABASE_DB_URL to the Supabase Postgres connection string (Project Settings → Database).')
  process.exit(1)
}

interface Row {
  id: string
  email: string | null
  encrypted_password: string | null
  username: string | null
  display_name: string | null
  phone: string | null
  role: string | null
  status: string | null
  meta: any
}

function pickUsername(r: Row): string {
  const fromProfile = r.username?.trim()
  if (fromProfile) return fromProfile.toLowerCase()
  const fromMeta = (r.meta?.username as string | undefined)?.trim()
  if (fromMeta) return fromMeta.toLowerCase()
  if (r.email) return r.email.split('@')[0].toLowerCase()
  return `user_${r.id.slice(0, 8)}`
}

async function uniqueUsername(base: string, taken: Set<string>): Promise<string> {
  let name = base
  let n = 1
  while (taken.has(name)) name = `${base}${n++}`
  taken.add(name)
  return name
}

async function main() {
  const pg = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await pg.connect()

  const { rows } = await pg.query<Row>(`
    SELECT u.id::text                AS id,
           u.email                   AS email,
           u.encrypted_password      AS encrypted_password,
           u.raw_user_meta_data      AS meta,
           p.username                AS username,
           p.display_name            AS display_name,
           p.phone                   AS phone,
           p.role                    AS role,
           p.status                  AS status
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    ORDER BY u.created_at ASC
  `)
  await pg.end()

  console.log(`Found ${rows.length} Supabase users. Importing into MySQL...`)

  // Seed the taken-usernames set with what's already in MySQL (e.g. 'admin').
  const existing = await prisma.user.findMany({ select: { username: true } })
  const taken = new Set(existing.map((u) => u.username))

  let imported = 0
  let noPassword = 0
  for (const r of rows) {
    const hasPw = !!r.encrypted_password && r.encrypted_password.startsWith('$2')
    if (!hasPw) noPassword++
    // OAuth-only / passwordless accounts get a random unusable hash so login
    // fails cleanly until they reset; everyone else keeps their real bcrypt hash.
    const passwordHash = hasPw ? (r.encrypted_password as string) : await bcrypt.hash(`reset-${r.id}-${Date.now()}`, 10)
    const username = await uniqueUsername(pickUsername(r), taken)
    const displayName = r.display_name?.trim() || (r.meta?.display_name as string | undefined)?.trim() || username
    const role = r.role || 'EMPLOYEE'
    const status = r.status || 'ACTIVE'

    try {
      await prisma.user.upsert({
        where: { id: r.id },
        create: {
          id: r.id, username, email: r.email || null, displayName,
          phone: r.phone || null, passwordHash, role, status,
        },
        update: {
          // Keep username stable on re-run; refresh the rest.
          email: r.email || null, displayName, phone: r.phone || null,
          passwordHash, role, status,
        },
      })
      imported++
    } catch (e) {
      console.warn(`  skip ${r.email || r.id}: ${(e as Error).message}`)
    }
  }

  console.log(`Done. Imported ${imported}/${rows.length} users.`)
  if (noPassword > 0) {
    console.log(`  ${noPassword} had no password (OAuth / passwordless) — they must use "ลืมรหัสผ่าน" to set one.`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
