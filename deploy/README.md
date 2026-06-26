# คู่มือติดตั้งแบบ Self-Hosted (MySQL) — ใช้งานบน LAN / Desktop / Online

ระบบนี้รองรับ 2 โหมดฐานข้อมูล เลือกตอน build ด้วยตัวแปร `VITE_DATA_BACKEND`:

| โหมด | ค่า | ใช้เมื่อ |
|------|-----|---------|
| **Supabase** (เดิม) | `supabase` (ค่าเริ่มต้น) | ใช้ cloud Supabase แบบเดิม — **ไม่ต้องตั้งอะไรเพิ่ม** |
| **MySQL** (ใหม่) | `mysql` | เก็บข้อมูลเองในเครื่อง/LAN ไม่พึ่ง cloud |

> ของเดิมไม่ถูกแตะ: ถ้าไม่ตั้ง `VITE_DATA_BACKEND=mysql` ระบบยังทำงานบน Supabase เหมือนเดิมทุกประการ

---

## 1) ติดตั้งบน LAN ด้วย Docker (วิธีแนะนำ)

ต้องมี **Docker + Docker Compose** บนเครื่องที่จะเป็น server (1 เครื่องในออฟฟิศ)

```bash
cd deploy
cp .env.example .env
# แก้ .env: เปลี่ยนรหัสผ่าน DB และ JWT secret ให้เป็นค่าสุ่มยาวๆ
docker compose up -d --build
```

เปิดใช้งานจากเครื่องไหนก็ได้ใน LAN ที่ browser:

```
http://<ip-ของเครื่อง-server>:3001
```

(หา IP ด้วย `ip addr` / `ifconfig` / `ipconfig` — เช่น `http://192.168.1.50:3001`)

**บัญชีเริ่มต้น** (สร้างอัตโนมัติครั้งแรก — เปลี่ยนรหัสทันทีหลัง login):
- `admin` / `admin1234` (SUPER_ADMIN)
- `manager1` / `pass1234` (MANAGER)

สิ่งที่ compose ทำให้: รัน MySQL + สร้าง schema (`prisma db push`) + seed admin + เปิด API ที่ serve ทั้งหน้าเว็บและ socket realtime บนพอร์ตเดียว (`:3001`) → **ไม่มีปัญหา CORS** และหลายเครื่องเห็นข้อมูลอัปเดตสดพร้อมกัน

ดู log / หยุด / อัปเดต:
```bash
docker compose logs -f api
docker compose down            # หยุด (ข้อมูลยังอยู่ใน volume mysql_data)
docker compose up -d --build   # อัปเดตหลังแก้โค้ด
```

---

## 2) ย้ายข้อมูลเดิมจาก Supabase → MySQL (ทำครั้งเดียว, ไม่บังคับ)

ถ้าจะยกข้อมูลที่มีอยู่บน Supabase มาใส่ MySQL (คง UUID เดิมครบ ไม่ลบของบน Supabase):

```bash
# รันหลังจาก docker compose up แล้ว (schema พร้อม)
docker compose exec api sh -c '
  SUPABASE_URL=https://xxxx.supabase.co \
  SUPABASE_SERVICE_KEY=<service-role-key> \
  npm run migrate:supabase
'
```

- ใช้ **service-role key** เพื่อให้ RLS ไม่บังข้อมูล
- สคริปต์ *อ่านอย่างเดียว* จาก Supabase แล้ว insert เข้า MySQL (idempotent — รันซ้ำได้)
- **รหัสผ่านผู้ใช้ย้ายไม่ได้** (Supabase Auth ไม่เปิดให้ export hash) → ผู้ใช้สมัครใหม่/รีเซตรหัสในระบบใหม่ บัญชี `admin` ที่ seed ไว้ใช้อนุมัติผู้ใช้ใหม่ได้

ตรวจสอบ: เทียบจำนวนแถวแต่ละตารางระหว่าง Supabase กับ MySQL

---

## 3) Desktop app (โปรแกรมติดตั้ง)

แนวทางแนะนำคือ **thin client**: หน้าเว็บเดียวกันห่อด้วย Tauri/Electron ชี้ไปที่ server LAN
→ ทุกเครื่องแชร์ฐานข้อมูลเดียว ได้ realtime/หลายคนพร้อมกันเหมือนเปิดผ่าน browser

ขั้นตอนย่อ (Tauri):
1. ติดตั้ง Tauri CLI แล้ว `tauri init` ในโปรเจกต์
2. ตั้ง `build.devUrl` / `frontendDist` ให้ใช้ build ของ Vite ที่ทำด้วย
   `VITE_DATA_BACKEND=mysql VITE_API_URL=http://<server-ip>:3001 npm run build`
3. `tauri build` → ได้ตัวติดตั้ง (.msi/.dmg/.AppImage)

> ทางเลือกแบบฝัง MySQL ในเครื่องเดียว (offline) ทำได้ แต่จะเสียคุณสมบัติหลายคน/realtime — ไม่แนะนำเป็นค่าเริ่มต้น

---

## 4) เข้าจากนอกออฟฟิศ (online)

อย่าเปิดพอร์ต MySQL ออกเน็ต ให้เปิดเฉพาะหน้าเว็บผ่าน reverse proxy ที่มี HTTPS:
- ง่ายสุด: **Cloudflare Tunnel** ชี้ไป `http://localhost:3001` (ฟรี, มี HTTPS, จำกัดสิทธิ์การเข้าถึงได้)
- หรือ nginx/Caddy ใส่ TLS หน้าพอร์ต 3001

---

## 5) โหมด dev (ไม่ใช้ Docker)

รัน MySQL เองที่เครื่อง แล้ว:
```bash
# server
cd server
cp .env.example .env            # ตั้ง DATABASE_URL=mysql://user:pass@localhost:3306/kps_erp
npm install
npm run db:generate:mysql
npm run db:push:mysql
npm run db:seed:mysql
npm run dev

# frontend (อีก terminal, ที่ repo root)
VITE_DATA_BACKEND=mysql VITE_API_URL=http://localhost:3001 npm run dev
```
ทดสอบ realtime: เปิด 2 browser แล้วแก้ข้อมูล ดูว่าอัปเดตสดข้ามเครื่อง

---

## กลับไปใช้ Supabase เดิม
แค่ build/รันโดย **ไม่ตั้ง** `VITE_DATA_BACKEND` (หรือ `=supabase`) — โค้ดเดิมทำงานเหมือนเดิม ไม่ต้องแก้อะไร
