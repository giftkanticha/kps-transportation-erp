# Database Design — KPS Transportation ERP

เอกสารอ้างอิงระยะยาวสำหรับ Supabase Postgres schema. ดู `auth-database-overview.md` สำหรับภาพรวม + decision tree, ไฟล์นี้เน้น schema detail.

## ขั้นตอนรัน Migration (ครั้งแรก)

```
0001_erp_core_schema.sql           ← 28 ตารางหลัก
0002_erp_rls_and_realtime.sql      ← RLS permissive + Realtime สำหรับทุกตาราง
0003_user_profiles_and_trigger.sql ← user_profiles + auto-create trigger บน auth.users
0004_seed_minimal.sql              ← seed รถ 7 + พนักงาน 4 (สำหรับ thin slice)
0005_rls_per_role.sql              ← เปลี่ยน RLS เป็น per-role + ALTER user_profiles เพิ่ม employee_id
0006_seed_full.sql                 ← seed เต็มจาก src/data/seed.ts (customers, partners, dispatch, tires, fuel, expenses)
0007_indexes.sql                   ← 35+ indexes บน FK + filter columns
0008_realtime_trim.sql             ← เก็บ realtime แค่ 4 ตาราง (vehicles, dispatch, dispatch_legs, fuel_rounds)
```

รันทีละไฟล์ใน Supabase Dashboard → SQL Editor → New query → paste → Run

---

## โครงสร้าง 6 โดเมน

### Master Data (เปลี่ยนน้อย — read-mostly)

| ตาราง | คีย์หลัก | FK | RLS |
|------|---------|-----|-----|
| `vehicles` | id (TEXT) | `driver_id → employees` | read all, write manager+, delete admin |
| `employees` | id (TEXT) | `vehicle_id → vehicles` | read all, write admin/manager+ |
| `customers` | id (TEXT) | — | read all, write manager+ |
| `partners` | id (TEXT) | — | read all, write manager+ |
| `subcontractors` | id (TEXT) | — | read all, write manager+ |
| `sub_drivers` | id (TEXT) | `sub_id → subcontractors` | read all, write manager+ |
| `user_profiles` | id (UUID = auth.users.id) | `employee_id → employees` | self-read, admin all |

### Operations (เปลี่ยนรายวัน)

| ตาราง | คีย์หลัก | FK | RLS |
|------|---------|-----|-----|
| `dispatch` | id (TEXT) | `customer_id`, `driver_id`, `vehicle_id`, `subcontractor_id` | manager+ all, driver only own |
| `dispatch_legs` | id (TEXT) | `dispatch_id (CASCADE)`, `customer_id` | inherits from parent dispatch |
| `sub_jobs` | id (TEXT) | `sub_id`, `driver_id → sub_drivers` | manager+ only |
| `maintenance` | id (TEXT) | `vehicle_id`, `partner_id` | read all, write manager+ |

### Tires

| ตาราง | คีย์หลัก | FK | RLS |
|------|---------|-----|-----|
| `tires` | id (TEXT) | `vehicle_id` | read all, write manager+ |
| `tire_events` | id (TEXT) | `tire_id (CASCADE)`, `vehicle_id` | read all, write manager+ |
| `tire_scrap_sales` | id (TEXT) | `tire_id (CASCADE)` | read all, write manager+ |

### Fuel

| ตาราง | คีย์หลัก | FK | RLS |
|------|---------|-----|-----|
| `fuel_records` | id (TEXT) | `vehicle_id`, `driver_id` | manager+ all, driver only own |
| `fuel_stock` | id (TEXT) | — | manager+ read, admin write |
| `fuel_rounds` | id (TEXT) | `vehicle_id`, `dispatch_round_id`. refills เป็น JSONB | manager+ all, driver via dispatch link |
| `fuel_transactions` | id (TEXT) | `vehicle_id`, `trip_id → dispatch` | manager+ all, driver via trip link |

### Finance

| ตาราง | คีย์หลัก | FK | RLS |
|------|---------|-----|-----|
| `expenses` | id (TEXT) | `vehicle_id`, `driver_id`, `partner_id` | manager+ all, driver only own |
| `expense_headers` | id (TEXT) | `vehicle_id`, `partner_id` | manager+ only |
| `expense_lines` | id (TEXT) | `header_id (CASCADE)`, `stock_item_id` | manager+ only |
| `fixed_costs` | id (TEXT) | `vehicle_id` | manager+ read, admin write |
| `stock_items` | id (TEXT) | — | read all, write manager+ |
| `stock_receipts` | id (TEXT) | `stock_item_id`, `partner_id` | read all, write manager+ |

### Admin / Audit

| ตาราง | คีย์หลัก | FK | RLS |
|------|---------|-----|-----|
| `activity_logs` | id | — | read all, insert system |
| `task_completions` | id | `vehicle_id (CASCADE)` | read all, anyone insert |
| `edit_approvals` | id | `vehicle_id (CASCADE)`. changes/change_fields เป็น JSONB | read all, anyone insert, manager+ approve |
| `vehicle_registrations` | id | data JSONB | manager+ only |
| `request_approvals` | id | data JSONB | manager+ read, anyone insert |

---

## Role Hierarchy

```
SUPER_ADMIN  ─┐
              ├── เห็น/แก้/ลบ ทุกตาราง รวม salary, account_no, role assignment
ADMIN        ─┘    (delete operations เฉพาะ admin)

MANAGER       ── เห็น/แก้ทุก operational data (vehicles, dispatch, fuel, expenses, tires, maintenance)
              │   ไม่สามารถ delete (admin only)
              │   ไม่สามารถแก้ salary หรือ role
              │
EMPLOYEE      ── (= DRIVER)
              │   เห็นแค่ rows ที่ตัวเองเกี่ยวข้อง:
              │   • dispatch ที่ driver_id = ตัวเอง
              │   • fuel_records ที่ตัวเองเป็นคนเติม
              │   • expenses ที่ตัวเองเบิก
              │   • fuel_rounds/transactions ที่เชื่อมกับ dispatch ของตัวเอง
              │   เห็น read-only: vehicles, customers, partners, maintenance, tires
              │   ไม่เห็น: salary fields, expense_headers/lines, fuel_stock, sub_jobs, fixed_costs
```

### Helper functions (สร้างใน 0005)

| Function | Returns | ใช้ทำอะไร |
|---------|---------|----------|
| `is_admin()` | BOOLEAN | ตรวจว่า user เป็น SUPER_ADMIN หรือ ADMIN |
| `is_manager_or_above()` | BOOLEAN | ตรวจว่าเป็น MANAGER ขึ้นไป |
| `my_employee_id()` | TEXT | คืน employee_id ของ user ปัจจุบัน (สำหรับ scope driver) |

ทุก function เป็น `STABLE SECURITY DEFINER` — เร็วและปลอดภัยเรียกจาก RLS policy.

---

## Realtime Subscriptions (หลัง 0008)

### ✅ เปิดอยู่ (4 ตาราง)
- `vehicles` — driver/manager ต้องเห็นสถานะรถสด (available/on-trip/maintenance)
- `dispatch` + `dispatch_legs` — manager ต้องเห็นรอบงานเปลี่ยนสด
- `fuel_rounds` — เปิด/ปิดรอบสด

### ❌ ปิด (24 ตาราง)
ใช้ React Query refetch on focus + manual refresh แทน — ประหยัด bandwidth + Supabase cost

---

## Indexes (หลัง 0007)

ทุก FK column มี index. เพิ่ม index บน filter columns ที่ใช้บ่อย:
- `dispatch.date DESC`, `dispatch.status`, `dispatch.round_status`
- `fuel_records.date DESC`
- `expenses.date DESC`, `expense_headers.date DESC`
- `vehicles.status`, `tires.status`, `fuel_rounds.status`
- `activity_logs.at DESC`

ตรวจการใช้งานด้วย:
```sql
EXPLAIN ANALYZE SELECT * FROM dispatch WHERE vehicle_id = 'v1';
-- ต้องเห็น "Index Scan using idx_dispatch_vehicle_id" ไม่ใช่ "Seq Scan"
```

---

## Onboarding ผู้ใช้ใหม่

1. User signup ผ่าน `LoginScreen` → `supabase.auth.signUp({ email, password })`
2. Trigger `on_auth_user_created` (จาก 0003) สร้าง row ใน `user_profiles`:
   - role = `'EMPLOYEE'`
   - status = `'ACTIVE'`
   - employee_id = NULL
3. **Admin ต้อง assign:**
   - role → ที่ถูกต้อง (MANAGER/ADMIN ถ้าจำเป็น)
   - employee_id → link กับ row ใน `employees` (ถ้าเป็น DRIVER)
4. User refresh — ตอนนี้เห็นข้อมูลตาม role

⚠️ **ถ้า admin ลืม assign `employee_id` ให้ DRIVER** → driver จะเห็น dispatch/fuel/expenses ว่างเปล่า (เพราะ `my_employee_id()` คืน NULL)

แก้: สร้างหน้า admin "User Management" ที่ list users + dropdown assign employee_id + role.

---

## Decision Notes

### ทำไมใช้ JSONB สำหรับ `dispatch.legs` และ `fuel_rounds.refills`
- ใช้ `dispatch_legs` ตารางแยก (มีอยู่แล้ว) → relational query ได้
- ใช้ JSONB ใน `fuel_rounds.refills` → nested array, query rare, ง่ายกว่าตารางแยก
- หาก reporting ซับซ้อนขึ้น (เช่น query refill per supplier) ค่อย normalize ทีหลัง

### ทำไม `user_profiles.employee_id` แทนที่จะ embed role ใน employees
- `auth.users` ↔ `user_profiles` 1:1 (Supabase native)
- `user_profiles` ↔ `employees` optional 1:1 (ไม่ใช่ทุก user เป็น employee, เช่น admin ที่ไม่ใช่พนักงานขับ)
- ทำให้ role-based RLS clean: เช็ค `user_profiles.role` ก่อนเสมอ

### ทำไมไม่ใช้ Postgres view ซ่อน salary
- ระยะนี้ใช้ application-level filter (UI ไม่แสดง salary ถ้าไม่ใช่ admin) — ง่ายกว่า
- Phase 2 ถ้าต้องการ enforce ที่ DB → สร้าง view + revoke column grant

---

## Verification Checklist

หลังรัน 0001-0008 ครบ:

```sql
-- ใน Supabase SQL Editor

-- 1. ตรวจตาราง
SELECT count(*) FROM vehicles;        -- ควรได้ 7
SELECT count(*) FROM employees;       -- ควรได้ 10
SELECT count(*) FROM dispatch;        -- ควรได้ 7
SELECT count(*) FROM tires;           -- ควรได้ 11

-- 2. ตรวจ trigger สร้าง profile
-- (ทดสอบหลัง signup ผ่าน app)
SELECT id, display_name, role, status FROM user_profiles;

-- 3. ตรวจ indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'dispatch';
-- ควรเห็น idx_dispatch_customer_id, idx_dispatch_driver_id, ฯลฯ

-- 4. ตรวจ realtime publication
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ควรเห็นแค่ 4: vehicles, dispatch, dispatch_legs, fuel_rounds

-- 5. ตรวจ RLS policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- ทุกตารางควรมี policy ใหม่จาก 0005 ไม่ใช่ "authenticated_all" แบบเก่า

-- 6. ทดสอบ RLS เป็น driver
-- (ทำผ่าน app: login เป็น user role EMPLOYEE + assign employee_id = 'e1')
-- เห็น dispatch แค่ row ที่ driver_id = 'e1' (t2)
```

---

## Rollback Plan

ถ้าต้องการเลิกใช้ Supabase + กลับไป localStorage:
1. ใน `src/context/AuthContext.tsx` ตั้ง `BYPASS_AUTH = true`
2. โค้ดทุกหน้าที่ใช้ `useList/useInsert/...` กลับไปใช้ `db.getAll/db.add/...`
3. ลบ env vars ใน Vercel
4. ข้อมูลใน Supabase ยังอยู่ — สามารถ resume migration ภายหลังได้
