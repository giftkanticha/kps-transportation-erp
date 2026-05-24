# คู่มือเข้าใจ Login + Database — KPS Transportation ERP

## Context

ระบบมี 3 layer ทำหน้าที่ทับซ้อนกันและไม่ค่อยสอดคล้อง — เอกสารนี้สรุปว่าระบบไหนทำอะไร, ทำไม login ถึงล้มเหลวบ่อย, และมีทางเลือก 3 ทางในการเคลียร์ระบบ.

## ภาพรวมสถาปัตยกรรม

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER (React + Vite)                       │
│                                                                  │
│  ┌─ Auth ──────────────────┐    ┌─ App Data ──────────────────┐ │
│  │ AuthContext.tsx          │    │ db.ts (localStorage)         │ │
│  │  ├─ BYPASS_AUTH = true ⚠ │    │  ├─ vehicles, dispatch,...   │ │
│  │  └─ supabase.auth (real) │    │  └─ key: kps_erp_v5          │ │
│  │     ↓                    │    └──────┬────────────────────────┘ │
│  │     LoginScreen          │           │ ไม่มี sync ออกนอก browser │
│  └──────────┬───────────────┘           │                          │
└─────────────┼──────────────────────────┼──────────────────────────┘
              │                          │ ❌ ไม่ติดต่อกัน
              ↓ HTTPS
   ┌──────────────────────┐      ┌─────────────────────────┐
   │   SUPABASE           │      │   EXPRESS + PRISMA       │
   │   (auth + 28 tables) │      │   (server/ — dead code)  │
   │   - auth.users       │      │   - User (SQLite)         │
   │   - user_profiles    │      │   - JWT routes /api/auth/*│
   │   - vehicles,...     │      │   - ไม่มีใครเรียก         │
   └──────────────────────┘      └─────────────────────────┘
   ❗ schema มีแล้ว                  ❗ มีโค้ดครบ แต่ frontend
   แต่ frontend ไม่ได้ใช้              ไม่ได้ใช้เลย (dead code)
```

**ข้อสรุปสำคัญ:** ตอนนี้ frontend ใช้แค่ **localStorage** เก็บข้อมูลจริง. Supabase กับ Express ทั้งคู่ "พร้อมใช้" แต่ "ไม่ถูกเชื่อม". Login ที่พยายามทำผ่าน Supabase ก็เลยเสี่ยงล้มเหลวเพราะ user_profiles อาจไม่มี row, หรือ RLS block.

---

## 1. ระบบ Authentication

### Frontend (ที่ทำงานจริง)

| ไฟล์ | บทบาท |
|------|-------|
| `src/lib/supabase.ts` | สร้าง Supabase client. ถ้า env ขาด → ใช้ placeholder URL (ไม่ throw) |
| `src/context/AuthContext.tsx:10` | `BYPASS_AUTH = true` — flag ที่ทำให้ทุก session = SUPER_ADMIN ปลอม |
| `src/pages/auth/LoginScreen.tsx` | UI form login เรียก `supabase.auth.signInWithPassword()` |
| `src/pages/auth/RegisterPage.tsx` | เรียก `supabase.auth.signUp()` — สร้าง auth user แต่ไม่ได้สร้าง row ใน `user_profiles` |
| `src/App.tsx:93` | `if (!legacyUser) return <LoginScreen />` — gate |

**Auth state สร้างจาก 2 ส่วน:**
1. `session` — Supabase auth user (มี email + uid)
2. `profile` — row จาก `user_profiles` ที่ join กับ session.user.id

ถ้า profile หาย → `legacyUser` = null → เด้งกลับ LoginScreen แม้ session ยังอยู่.

### Server-side (Express — dead code)

| ไฟล์ | บทบาท | สถานะ |
|------|-------|-------|
| `server/src/routes/auth.ts` | `/api/auth/login`, `/register`, ฯลฯ | 💀 ไม่มีใครเรียก |
| `server/src/services/AuthService.ts` | bcrypt + JWT | 💀 ไม่ได้ใช้ |
| `server/src/services/AclService.ts` | Role-based permissions | 💀 ไม่ได้ใช้ |
| `server/src/middleware/auth.ts` | `requireAuth`, `requireRole(...)` | 💀 ไม่ได้ใช้ |

โค้ดเก่าจากตอนเดิมวางแผนใช้ Express+JWT — ภายหลังเปลี่ยนเป็น Supabase auth (commit `497bac1`) แต่ของเก่าไม่ได้ลบ.

---

## 2. Database 3 ที่ทับกัน

### Layer A: localStorage (ใช้งานจริงตอนนี้ 100%)

- **ไฟล์:** `src/lib/db.ts`
- **เก็บที่:** `localStorage['kps_erp_v5']`
- **เนื้อหา:** vehicles, employees, dispatch, fuel rounds, tires, expenses
- **Init:** ถ้า key ไม่มี → load `src/data/seed.ts`

**ข้อดี:** ไม่ต้องตั้ง backend, refresh ก็ยังอยู่, dev เร็ว
**ข้อเสีย:**
- 🔴 เปลี่ยน browser/เครื่อง → ข้อมูลหายหมด
- 🔴 หลายคนใช้พร้อมกันไม่ได้
- 🔴 ลบ cookies = ลบข้อมูลทั้งหมด

### Layer B: Supabase Postgres (พร้อม schema แต่ยังไม่ได้ใช้เก็บข้อมูล)

- **Migrations:** `supabase/migrations/0001_erp_core_schema.sql` (28 tables) + `0002_erp_rls_and_realtime.sql`
- **+ มี `user_profiles`** ผูกกับ `auth.users` (id, display_name, phone, role, status)
- **RLS:** เปิดแล้ว แต่ policy `USING (true)` — เปิดให้ authenticated เข้าได้ทั้งหมด (Phase 0)
- **CRUD helper:** `src/lib/crud.ts` (33 บรรทัด) **แต่ไม่มี page ไหนเรียก**

**ข้อดี:** built-in auth + RLS + Realtime, ฟรีถึง 500MB
**ข้อเสีย:**
- 🟡 ต้อง migrate ข้อมูลจาก localStorage มาก่อน
- 🟡 ต้องเขียน trigger สร้าง `user_profiles` ทุกครั้ง signup

### Layer C: Prisma + SQLite (server/ — ไม่ใช้)

- **Schema:** `server/prisma/schema.prisma` — SQLite `dev.db`
- **Tables:** User, LoginHistory, PasswordReset, RolePermission, AuditLog
- **Seed:** `server/src/seed.ts` (hardcoded password `admin1234` ⚠)

💀 ไม่ได้เชื่อมกับอะไรเลย

---

## 3. ทำไม Login Refresh แล้วเด้งออก — Root Cause

เมื่อ `BYPASS_AUTH = false`:

```
[Browser refresh]
    ↓
supabase.auth.getSession() → ดึง session จาก localStorage (key: sb-{proj}-auth-token)
    ↓
ถ้า session มี → fetchProfile(user.id)
    ↓
SELECT * FROM user_profiles WHERE id = '{auth.user.id}'
    ↓
❌ ไม่เจอ row! (เพราะ signup ไม่ได้สร้าง profile auto)
    ↓
profile = null
    ↓
legacyUser = null
    ↓
App.tsx render <LoginScreen />  ← เด้งออก
```

**สาเหตุที่เป็นไปได้ 5 อัน:**

1. `user_profiles` row ไม่ถูกสร้าง (ไม่มี Supabase trigger)
2. RLS block SELECT
3. Session token หมดอายุ + refresh ไม่ได้เพราะ env URL/key ผิด
4. `profile.status !== 'ACTIVE'` (เช่น `PENDING_APPROVAL`)
5. `VITE_SUPABASE_URL`/`ANON_KEY` ขาดใน Vercel → fallback placeholder → ทุก call fail

---

## 4. สรุปปัญหาทั้งหมด

| # | ปัญหา | ระดับ |
|---|-------|------|
| 1 | มี 3 database ที่ไม่ sync | 🔴 Critical |
| 2 | Frontend ใช้ localStorage → ขึ้น production จริงไม่ได้ | 🔴 Critical |
| 3 | Signup ไม่สร้าง `user_profiles` row | 🔴 Critical |
| 4 | Express server เป็น dead code | 🟡 cleanup |
| 5 | Hardcoded admin password ใน server seed | 🟡 ลบ |
| 6 | RLS policy permissive (`USING (true)`) | 🟡 ทำตอน production |

---

## 5. ทางเลือก 3 ทาง

| ทาง | ความเหมาะสม | เวลา | เอกสาร |
|----|------------|------|--------|
| 🅰️ **Supabase-only** | Production จริง | 3-5 วัน | [option-A](./options/option-A-supabase-only.md) |
| 🅱️ **localStorage + bypass** | Demo/POC | 1-2 ชม | [option-B](./options/option-B-localstorage-demo.md) |
| 🅲 **Hybrid** (auth Supabase + data local) | Middle ground | 1 วัน | [option-C](./options/option-C-hybrid.md) |

ดูเอกสารแต่ละทาง — มี code skeleton + SQL migrations + step-by-step setup พร้อมก๊อปไปลองในโฟลเดอร์ใหม่ได้

---

## 6. ไฟล์สำคัญที่ควรเปิดดูเอง

| อยากเข้าใจ | เปิด |
|-----------|-----|
| Auth bypass ตอนนี้ทำงานยังไง | `src/context/AuthContext.tsx:1-50` |
| Login form + demo accounts | `src/pages/auth/LoginScreen.tsx` |
| Supabase config | `src/lib/supabase.ts` |
| Schema ทั้งหมด (Supabase) | `supabase/migrations/0001_erp_core_schema.sql` |
| RLS policy (permissive) | `supabase/migrations/0002_erp_rls_and_realtime.sql` |
| Database localStorage logic | `src/lib/db.ts:40-100` |
| Seed data | `src/data/seed.ts` |
| Express auth (dead) | `server/src/routes/auth.ts`, `services/AuthService.ts` |
| Frontend gate | `src/App.tsx:83-94` |

---

## 7. คำถามชี้นำ

ก่อนเลือกทาง ลองตอบ:

1. **โปรเจกต์นี้จะ deploy ให้ใครใช้?** ตัวเอง → 🅱️, ทีม 3-5 คน → 🅲, production จริง → 🅰️
2. **ข้อมูลต้อง persist ข้ามเครื่อง/เบราว์เซอร์หรือไม่?** ถ้าใช่ → ต้องไป 🅰️
3. **มีเวลาเขียน CRUD ใหม่ทุก page หรือไม่?** ถ้าไม่ → 🅲 เป็น middle ground
