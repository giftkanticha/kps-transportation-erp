# 🅲 Option C — Hybrid (Supabase Auth + localStorage Data)

**เหมาะสำหรับ:** middle ground — มี login จริง แต่ไม่อยาก rewrite CRUD
**เวลา:** 1 วัน
**ข้อดี:** Login จริง (ข้ามเครื่อง login ได้), ไม่ต้อง rewrite CRUD, มี audit ของ user
**ข้อเสีย:** ข้ามเครื่อง login ได้ **แต่ data ยังคนละชุด** — อาจสับสน. **ไม่เหมาะถ้าทีมหลายคน**

---

## แนวคิด

- Supabase: ใช้แค่ auth (login/signup/profile) — **ไม่ใช้ table ข้อมูลใดๆ**
- localStorage: เก็บ vehicles, dispatch, fuel, tires, ฯลฯ ทั้งหมด (ตาม `db.ts` เดิม)
- ทำให้ user login จาก browser ไหนก็ได้ แต่ data ยังเฉพาะ browser นั้น

---

## ไฟล์ที่ต้องลบ

```
server/                              # ลบทั้งโฟลเดอร์
src/lib/crud.ts                      # ลบ (ไม่ใช้ Supabase REST)
```

**ไม่ต้องลบ:**
- `supabase/migrations/` — เก็บไว้ใช้ auth + user_profiles
- `src/pages/auth/LoginScreen.tsx` — ยังใช้

---

## Supabase setup

### 1. สร้าง project + ใส่ env vars

ดู Option A "Setup steps" — ทำเหมือนกัน

### 2. รัน migrations แค่ที่จำเป็น

ต้องการแค่ตาราง `user_profiles`. ลบ migration อื่นที่ไม่ใช้ออก หรือเขียน migration เล็กๆ ใหม่:

### `supabase/migrations/0001_minimal_auth.sql` (ใหม่ — แทน 0001+0002 เดิม)

```sql
-- ตาราง user_profiles ผูกกับ auth.users
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text default '',
  role text not null default 'EMPLOYEE'
    check (role in ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE')),
  status text not null default 'ACTIVE'
    check (status in ('PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'LOCKED')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table user_profiles enable row level security;

create policy "self_read" on user_profiles
  for select to authenticated
  using (id = auth.uid());

create policy "self_update" on user_profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## โค้ดที่ต้องแก้

### `src/lib/supabase.ts` — ลบ placeholder fallback (เหมือน Option A)

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

### `src/context/AuthContext.tsx` — ลบ BYPASS_AUTH (เหมือน Option A)

ใช้โค้ดเดียวกับ Option A — ดู option-A-supabase-only.md section "AuthContext"

### `src/lib/db.ts` — **ไม่แก้** ปล่อยให้เป็น localStorage เหมือนเดิม

---

## การทำงาน step-by-step

### Step 1: ตั้ง Supabase project (15 นาที)
- สร้าง project บน supabase.com
- ใส่ `.env.local` กับ URL + anon key

### Step 2: รัน migration (10 นาที)
- Copy SQL จาก `0001_minimal_auth.sql` → SQL Editor
- กด Run

### Step 3: ลบ server/ + crud.ts (5 นาที)
```bash
rm -rf server/
rm src/lib/crud.ts
```

### Step 4: แก้ supabase.ts + AuthContext.tsx (30 นาที)
- ลบ placeholder fallback ใน `supabase.ts`
- ลบ `BYPASS_AUTH` ใน `AuthContext.tsx`

### Step 5: ลบ scripts ที่ไม่ใช้ใน package.json (10 นาที)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

ลบ `dev:server`, `dev:all`, `server:setup`, dependency `concurrently`

### Step 6: Test (30 นาที)
- Sign up ใหม่ ด้วย email + password
- ตรวจใน Supabase Studio → ตาราง `user_profiles` มี row ใหม่
- Login → เข้าแอป
- Refresh → ยังอยู่ในแอป ✅
- Logout → กลับมา LoginScreen
- Login จากเครื่องอื่น → entry ได้ แต่ data localStorage จะ seed ใหม่ ⚠

---

## สิ่งที่ต้องระวัง

### 1. ⚠️ Data ไม่ sync ระหว่างเครื่อง
- Login จาก laptop → เห็นข้อมูลที่บันทึกจาก laptop
- Login จาก phone → เห็นข้อมูล seed ใหม่ (ว่างเปล่า) เพราะ phone localStorage ไม่มี
- **ไม่เหมาะถ้ามีหลายคนใช้**

### 2. ⚠️ Clear cookies = ลบ data
- Cookies/localStorage ของ browser ถูก clear → ข้อมูลหายหมด แม้ login ผ่าน
- แก้ได้ด้วย Export/Import JSON (ดู Option B section ท้าย)

### 3. ⚠️ User ใหม่ signup → status = ACTIVE ทันที
- ถ้าต้องการให้ admin อนุมัติก่อน → แก้ trigger ให้ default `status = 'PENDING_APPROVAL'`

---

## Verification

- [ ] Signup ใหม่ → Supabase Studio: `auth.users` + `user_profiles` มี row ใหม่
- [ ] Login → เข้าแอป + เห็น dashboard
- [ ] **Refresh แล้วยังอยู่ในแอป** ← จุดที่อยากแก้ที่สุด
- [ ] Logout → กลับ LoginScreen
- [ ] Login ใหม่ → ข้อมูล localStorage ยังอยู่
- [ ] เปิด incognito → ต้อง login ใหม่ + ข้อมูล localStorage ว่าง

---

## Upgrade path C → A (ทีหลัง)

ถ้าวันหนึ่งอยาก migrate data ไปยัง Supabase ด้วย:

1. สร้าง migrations 0002+ (vehicles, dispatch, ฯลฯ) — ใช้ Option A's 0001_erp_core_schema.sql
2. เขียน script `migrate-local-to-supabase.ts`:
   ```ts
   const local = JSON.parse(localStorage.getItem('kps_erp_v5')!)
   for (const v of local.vehicles) {
     await supabase.from('vehicles').upsert(v)
   }
   // ... ทำซ้ำสำหรับทุก table
   ```
3. แทน `db.ts` ด้วย Supabase wrapper (จาก Option A)
4. ลบ localStorage init

ระยะเวลา upgrade: 2-3 วัน (เพราะข้อมูลมีอยู่ — แค่ rewrite frontend CRUD)

---

## เปรียบเทียบกับทางอื่น

|  | Option A | Option B | **Option C** |
|--|---------|---------|-------------|
| Real login | ✅ | ❌ | ✅ |
| Data ข้ามเครื่อง | ✅ | ❌ | ❌ |
| Multi-user | ✅ | ❌ | ⚠ (auth ใช่, data ไม่) |
| ต้อง rewrite CRUD | ใช่ (2000+ บรรทัด) | ไม่ | **ไม่** |
| Setup time | 3-5 วัน | 1-2 ชม | **1 วัน** |
| ต้อง backend | Supabase | ไม่มี | Supabase |

Option C เหมาะถ้า: **อยากมี real login แต่ data ยังเป็น single-user ก็พอ**
