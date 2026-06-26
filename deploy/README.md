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

## อีเมลรีเซตรหัสผ่าน (SMTP) + แก้โปรไฟล์

**แก้โปรไฟล์ผู้ใช้:** ผู้ดูแล (admin) แก้ชื่อ/username/เบอร์โทร และตั้งรหัสผ่านใหม่ให้ผู้ใช้คนอื่นได้ที่หน้า "จัดการผู้ใช้งาน" (ทำงานทั้งสองโหมด)

**รีเซตรหัสผ่านด้วยตัวเอง:** มีลิงก์ "ลืมรหัสผ่าน?" ที่หน้า login → กรอกอีเมล → ระบบส่งลิงก์รีเซตไปทางอีเมล (ถ้าตั้งค่า SMTP) หรือแสดงลิงก์บนหน้าจอ (ถ้ายังไม่ตั้ง SMTP) → คลิกลิงก์ตั้งรหัสใหม่

ตั้งค่า SMTP ใน `.env` (ไม่บังคับ — ถ้าไม่ตั้ง ระบบยังรีเซตได้โดยแสดงลิงก์บนจอแทน):
```
APP_BASE_URL=http://192.168.1.50:3001   # URL ที่ผู้ใช้เปิดจริง (ใส่ในลิงก์อีเมล)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false                        # true ถ้าใช้พอร์ต 465
SMTP_USER=you@gmail.com
SMTP_PASS=app-password                    # Gmail ต้องใช้ App Password
SMTP_FROM=KPS ERP <you@gmail.com>
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

ตรวจสอบ: เทียบจำนวนแถวแต่ละตารางระหว่าง Supabase กับ MySQL

### ย้ายผู้ใช้ + รหัสผ่านเดิม (ไม่ต้องให้ผู้ใช้ตั้งรหัสใหม่)

รหัสผ่านใน Supabase Auth เก็บเป็น **bcrypt hash** เหมือนระบบนี้ → คัดลอก hash มาได้ตรงๆ **ผู้ใช้ใช้รหัสเดิม login ได้ทันที** แต่ hash อยู่ในตาราง `auth.users` ที่ REST API มองไม่เห็น จึงต้องต่อ **Postgres ตรง**:

1. เอา connection string จาก Supabase: **Project Settings → Database → Connection string (URI)** (ต้องมีรหัส DB)
2. รัน:
```bash
docker compose exec api sh -c '
  SUPABASE_DB_URL="postgresql://postgres:[DB-PASSWORD]@db.xxxx.supabase.co:5432/postgres" \
  npm run migrate:users
'
```
- คง UUID ของผู้ใช้เดิมไว้ (อ้างอิงข้อมูลอื่นไม่พัง), คัดลอก bcrypt hash → ใช้รหัสเดิมได้เลย
- ผู้ใช้ที่สมัครผ่าน OAuth (Google ฯลฯ) ไม่มีรหัสผ่าน → ใช้ "ลืมรหัสผ่าน" ตั้งใหม่
- รันซ้ำได้ (upsert ตาม id)

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
