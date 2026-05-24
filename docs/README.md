# KPS ERP — Docs

## Auth + Database

ก่อนจะแก้ระบบ login/database ลองอ่านลำดับนี้:

1. **[auth-database-overview.md](./auth-database-overview.md)** ← เริ่มที่นี่
   ภาพรวม: มีระบบอะไรบ้าง, ทำไม login พัง, ปัญหาทั้งหมด

2. **เลือก 1 ใน 3 ทาง:**
   - [🅰️ Option A — Supabase-only](./options/option-A-supabase-only.md) (production, 3-5 วัน)
   - [🅱️ Option B — localStorage + Bypass](./options/option-B-localstorage-demo.md) (demo, 1-2 ชม)
   - [🅲 Option C — Hybrid](./options/option-C-hybrid.md) (middle ground, 1 วัน)

แต่ละทางมี code skeleton + SQL + step-by-step พร้อมก๊อปไปลองในโฟลเดอร์ใหม่

## ตัวเลือกอื่น

ถ้าอยากลอง storage อื่น (ที่ไม่ใช่ Supabase) ไอเดียที่คุ้มลอง:

| Backend | จุดเด่น | เหมาะกับ |
|---------|--------|---------|
| **Supabase** | Auth + Postgres + Realtime + RLS + Storage ครบในที่เดียว | Production |
| **Firebase (Firestore)** | NoSQL + Auth + Realtime | App ง่ายๆ, scale ดี |
| **PocketBase** | Single binary, self-host, รัน 1 process | Self-host, low budget |
| **Appwrite** | Open-source Firebase alternative | Self-host แต่อยากได้ feature ครบ |
| **Convex** | Reactive DB + functions | Real-time UI |
| **Express + Postgres** | Custom backend, ควบคุมเต็ม | ทีมที่มี backend dev |
| **Prisma + SQLite (local)** | File-based, ไม่ต้อง server | Single-user desktop app |

ถ้าสนใจตัวไหนเป็นพิเศษ บอกได้ — ผมจะเขียน option file เพิ่มให้
