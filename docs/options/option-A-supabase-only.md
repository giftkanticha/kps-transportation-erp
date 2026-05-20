# 🅰️ Option A — Supabase-only

**เหมาะสำหรับ:** Production จริง, ใช้หลายคน, ข้ามเครื่อง
**เวลา:** 3-5 วัน
**ข้อดี:** ระบบเดียว, Auth+DB+Realtime+Storage+RLS ในที่เดียว, ฟรีถึง 500MB
**ข้อเสีย:** ต้อง rewrite CRUD ทุก page (~2000 บรรทัด ที่ใช้ `db.`)

---

## Setup steps

### 1. สร้างโปรเจกต์ Supabase

1. ไป https://supabase.com → New project
2. ตั้งชื่อ + region (Singapore แนะนำ)
3. คัดลอก:
   - `Project URL` → ใช้เป็น `VITE_SUPABASE_URL`
   - `anon public key` → ใช้เป็น `VITE_SUPABASE_ANON_KEY`

### 2. ตั้ง env vars

สร้างไฟล์ `.env.local` ที่ root ของ project:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

บน Vercel: Project Settings → Environment Variables → เพิ่ม 2 ตัวข้างบน (สำหรับ Production + Preview + Development)

### 3. รัน migrations

ใช้ Supabase CLI (recommended):
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

หรือ copy-paste SQL ลง SQL Editor ใน Supabase Dashboard:
1. `supabase/migrations/0001_erp_core_schema.sql`
2. `supabase/migrations/0002_erp_rls_and_realtime.sql`
3. `0003_user_profile_trigger.sql` (ดูด้านล่าง — ใหม่)
4. `0004_seed_data.sql` (ดูด้านล่าง — ใหม่)

---

## ไฟล์ใหม่ที่ต้องสร้าง

### `supabase/migrations/0003_user_profile_trigger.sql`

**แก้ปัญหา:** signup แล้ว `user_profiles` ไม่ถูกสร้าง → login ไม่ผ่าน

```sql
-- Auto-create user_profiles row when a new auth.users is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (
    id, display_name, phone, role, status, created_at, updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'EMPLOYEE',
    'ACTIVE',  -- ถ้าต้อง admin อนุมัติก่อน → เปลี่ยนเป็น 'PENDING_APPROVAL'
    now(),
    now()
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ตรวจให้ user อ่าน profile ตัวเองได้
drop policy if exists "self_read_profile" on public.user_profiles;
create policy "self_read_profile" on public.user_profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "self_update_profile" on public.user_profiles;
create policy "self_update_profile" on public.user_profiles
  for update to authenticated
  using (id = auth.uid());

-- Admin อ่าน profile ทุกคน
drop policy if exists "admin_read_all_profiles" on public.user_profiles;
create policy "admin_read_all_profiles" on public.user_profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('SUPER_ADMIN', 'ADMIN')
    )
  );
```

### `supabase/migrations/0004_seed_data.sql`

```sql
-- Seed initial data (vehicles, employees, customers)
-- ดัดแปลงจาก src/data/seed.ts

insert into vehicles (id, plate, type, brand, status, odometer, driver_id) values
  ('v1', 'ABC-1234', '10ล้อ', 'Isuzu FVR', 'available', 245320, null),
  ('v2', 'DEF-5678', '18ล้อ', 'Hino 500', 'available', 180000, null),
  ('v3', 'GHI-9012', '10ล้อ', 'Hino 500', 'available', 195000, null)
on conflict (id) do nothing;

insert into employees (id, code, name, position, license, license_status, phone, salary) values
  ('e1', 'E001', 'สมชาย เสมเมือง', 'คนขับ', 'B', 'ok', '0812345678', 18000),
  ('e2', 'E002', 'สมหญิง ใจดี',    'คนขับ', 'B', 'ok', '0823456789', 18000)
on conflict (id) do nothing;

-- ... (ดู src/data/seed.ts เพื่อข้อมูลเต็ม)
```

---

## โค้ดที่ต้องแก้ใน frontend

### `src/lib/supabase.ts` — ลบ placeholder fallback

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'LOCKED'

export interface UserProfile {
  id: string
  display_name: string
  phone: string
  role: UserRole
  status: UserStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}
```

### `src/context/AuthContext.tsx` — ลบ BYPASS_AUTH ทั้งหมด

```ts
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type UserProfile, type UserRole } from '../lib/supabase'
import type { User, KPSRole } from '../types'

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  legacyUser: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isSuperAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ROLE_MAP: Record<UserRole, KPSRole> = {
  SUPER_ADMIN: 'admin', ADMIN: 'admin', MANAGER: 'manager', EMPLOYEE: 'driver',
}

function toLegacy(profile: UserProfile, email: string): User {
  return {
    id: profile.id, email, name: profile.display_name,
    role: ROLE_MAP[profile.role] ?? 'driver',
    avatar: '👤', phone: profile.phone,
    title: profile.role,
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles').select('*').eq('id', userId).maybeSingle()
  if (error) console.error('fetchProfile error:', error)
  return data as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      if (s) setProfile(await fetchProfile(s.user.id))
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      setProfile(s ? await fetchProfile(s.user.id) : null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    const p = await fetchProfile(data.user.id)
    if (!p) throw new Error('ไม่พบ profile — กรุณาติดต่อ admin')
    if (p.status !== 'ACTIVE') throw new Error(`บัญชี: ${p.status}`)
    setProfile(p)
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const legacyUser = session && profile && profile.status === 'ACTIVE'
    ? toLegacy(profile, session.user.email ?? '') : null

  return (
    <AuthContext.Provider value={{
      session, profile, legacyUser, loading, login, logout,
      isAdmin: profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN',
      isSuperAdmin: profile?.role === 'SUPER_ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
```

### `src/lib/db.ts` — แทนที่ด้วย Supabase wrapper

แทนที่ทั้งไฟล์ด้วย:

```ts
import { supabase } from './supabase'
import type { AppState } from '../types'

// Helper functions ที่ใช้แทน localStorage db
export const db = {
  async getAll<T>(table: keyof AppState): Promise<T[]> {
    const { data, error } = await supabase.from(table).select('*')
    if (error) { console.error(`getAll(${String(table)}):`, error); return [] }
    return (data ?? []) as T[]
  },

  async get<T>(table: keyof AppState, id: string): Promise<T | undefined> {
    const { data, error } = await supabase
      .from(table).select('*').eq('id', id).maybeSingle()
    if (error) { console.error(`get(${String(table)}, ${id}):`, error); return undefined }
    return (data ?? undefined) as T | undefined
  },

  async add<T>(table: keyof AppState, payload: T): Promise<T> {
    const { data, error } = await supabase
      .from(table).insert(payload as object).select().single()
    if (error) throw error
    return data as T
  },

  async update<T>(table: keyof AppState, id: string, patch: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(table).update(patch as object).eq('id', id).select().single()
    if (error) throw error
    return data as T
  },

  async remove(table: keyof AppState, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },

  // ── Round/Fuel helpers ที่เคยมีใน old db.ts → ต้องย้ายมาเป็น async
  async lastClosedMileage(vehicleId: string): Promise<number | null> {
    if (!vehicleId) return null
    const { data } = await supabase
      .from('dispatch')
      .select('end_odometer')
      .eq('vehicle_id', vehicleId)
      .eq('round_status', 'closed')
      .not('end_odometer', 'is', null)
      .order('end_odometer', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as { end_odometer: number | null } | null)?.end_odometer ?? null
  },

  // ... (ย้าย helpers อื่นจาก old db.ts มาเป็น async)
}
```

⚠️ **ผลกระทบ:** ทุก page ที่เรียก `db.getAll()` ต้องเปลี่ยนเป็น `await db.getAll()` + ใช้ใน `useEffect` หรือ `useQuery` แทน. แนะนำให้ใช้ `@tanstack/react-query` ที่มีอยู่ใน package.json อยู่แล้ว.

---

## Migration plan (ทีละ step)

### Phase 1: Setup (~ครึ่งวัน)
- [ ] สร้าง Supabase project
- [ ] รัน migration 0001, 0002, 0003, 0004
- [ ] ตั้ง env vars
- [ ] ลบ `BYPASS_AUTH` flag
- [ ] ทดสอบ signup + login

### Phase 2: ย้าย CRUD page ทีละโมดูล (~3 วัน)
- [ ] Vehicles (ง่ายสุด → ลองก่อน)
- [ ] Employees
- [ ] Dispatch (ซับซ้อน — มี legs, fuel rounds linked)
- [ ] Fuel rounds + transactions
- [ ] Tires + tire_events
- [ ] Expenses + headers + lines
- [ ] Subcontractors
- [ ] Reports (P&L, fuel report, expense pivot)

### Phase 3: Cleanup (~ครึ่งวัน)
- [ ] ลบ `server/` ทั้งโฟลเดอร์
- [ ] ลบ scripts ใน package.json ที่อ้างถึง server (`dev:server`, `dev:all`, `server:setup`)
- [ ] ลบ `concurrently` dependency
- [ ] ลบ `src/data/seed.ts` (ย้ายไป SQL seed แล้ว)
- [ ] เขียน RLS policy strict (replace permissive ใน 0002)

### Phase 4: Polish (~ครึ่งวัน)
- [ ] เพิ่ม loading states (เพราะ CRUD เป็น async ทั้งหมด)
- [ ] เพิ่ม error boundary
- [ ] Test refresh persistence
- [ ] Test multi-user (เปิด 2 browser cuối)
- [ ] Test RLS (login เป็น EMPLOYEE → ดูได้แค่ของตัวเอง?)

---

## Verification

- [ ] Signup ใหม่ → ตรวจใน Supabase Studio ว่า `user_profiles` มี row
- [ ] Refresh หลัง login → ยังอยู่ในแอป ไม่เด้งออก
- [ ] เปิด browser ใหม่/incognito → login ได้ + เห็นข้อมูลเดียวกัน
- [ ] เพิ่มรถใหม่ → refresh → ข้อมูลยังอยู่
- [ ] DevTools → Network → ดูว่า request ไป supabase.co ทั้งหมด, ไม่มี localStorage write

---

## Quick rollback

ถ้าทำแล้วพัง — กลับไปสภาพเดิม:
```bash
git checkout src/lib/db.ts src/lib/supabase.ts src/context/AuthContext.tsx
# ตั้ง BYPASS_AUTH = true อีกครั้งใน AuthContext.tsx
```
