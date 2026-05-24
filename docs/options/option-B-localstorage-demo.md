# 🅱️ Option B — localStorage + Bypass (Demo only)

**เหมาะสำหรับ:** Demo, POC, ใช้คนเดียว, ทดลอง UI
**เวลา:** 1-2 ชั่วโมง
**ข้อดี:** ง่ายสุด, ไม่มี backend pain, dev ต่อได้ทันที
**ข้อเสีย:** demo only — clear cookies = ลบข้อมูล, แชร์กับคนอื่นไม่ได้

---

## แนวคิด

- เอา auth ออกหมด — ไม่มี LoginScreen, ไม่มี Supabase
- ใช้ "role picker" หน้าแรกแทน (เลือกบทบาท SUPER_ADMIN / MANAGER / EMPLOYEE)
- ข้อมูลทุกอย่างยังอยู่ใน localStorage (ตาม `db.ts` เดิม)
- เก็บ "current user role" ใน localStorage เพื่อใช้ระหว่าง refresh

---

## ไฟล์ที่ต้องลบ

```
server/                              # ลบทั้งโฟลเดอร์
supabase/                            # ลบทั้งโฟลเดอร์
src/pages/auth/                      # ลบทั้งโฟลเดอร์ (LoginScreen, Register, ฯลฯ)
src/lib/supabase.ts                  # ลบ
src/lib/crud.ts                      # ลบ
src/context/AuthContext.tsx          # แทนที่ด้วยตัวใหม่ (ดูข้างล่าง)
```

---

## ไฟล์ใหม่

### `src/context/AuthContext.tsx` (เขียนใหม่ — local-only)

```tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, KPSRole } from '../types'

const SESSION_KEY = 'kps_demo_user'

const DEMO_USERS: User[] = [
  { id: 'demo-admin',   email: 'admin@kps.local',   name: 'ผู้ดูแลระบบ',   role: 'admin',   avatar: '👑', phone: '', title: 'Super Admin' },
  { id: 'demo-manager', email: 'manager@kps.local', name: 'ผู้จัดการ',     role: 'manager', avatar: '📋', phone: '', title: 'Manager' },
  { id: 'demo-driver',  email: 'driver@kps.local',  name: 'พนักงานขับรถ', role: 'driver',  avatar: '👤', phone: '', title: 'Employee' },
]

interface AuthContextValue {
  legacyUser: User | null
  login: (userId: string) => void
  logout: () => void
  isAdmin: boolean
  isSuperAdmin: boolean
  loading: false
  session: null
  profile: null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [legacyUser, setLegacyUser] = useState<User | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      const u = DEMO_USERS.find(d => d.id === saved)
      if (u) setLegacyUser(u)
    }
  }, [])

  const login = (userId: string) => {
    const u = DEMO_USERS.find(d => d.id === userId)
    if (u) {
      setLegacyUser(u)
      localStorage.setItem(SESSION_KEY, u.id)
    }
  }

  const logout = () => {
    setLegacyUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return (
    <AuthContext.Provider value={{
      legacyUser, login, logout,
      isAdmin: legacyUser?.role === 'admin' || legacyUser?.role === 'manager',
      isSuperAdmin: legacyUser?.role === 'admin',
      loading: false, session: null, profile: null,
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

export { DEMO_USERS }
```

### `src/pages/auth/RolePicker.tsx` (ใหม่ — แทน LoginScreen)

```tsx
import { useAuth, DEMO_USERS } from '../../context/AuthContext'

export function RolePicker() {
  const { login } = useAuth()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)',
    }}>
      <div style={{
        background: '#fff', padding: 40, borderRadius: 16, width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: '#1D4ED8',
            color: '#fff', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 800, fontSize: 26,
          }}>K</div>
          <h1 style={{ margin: '14px 0 4px', fontSize: 22 }}>KPS ERP — Demo</h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>เลือกบทบาทเพื่อเข้าใช้งาน</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DEMO_USERS.map(u => (
            <button
              key={u.id}
              onClick={() => login(u.id)}
              style={{
                display: 'flex', gap: 14, alignItems: 'center',
                padding: '14px 18px', border: '1px solid #E2E8F0',
                borderRadius: 12, background: '#F8FAFC', cursor: 'pointer',
                fontSize: 14, fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 28 }}>{u.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{u.title}</div>
              </div>
              <span style={{ color: '#1D4ED8' }}>→</span>
            </button>
          ))}
        </div>
        <p style={{ marginTop: 22, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
          ข้อมูลทั้งหมดเก็บใน browser นี้ — clear cookies = ลบข้อมูล
        </p>
      </div>
    </div>
  )
}
```

### `src/App.tsx` — แก้ import

```tsx
import { RolePicker } from './pages/auth/RolePicker'

// ... ใน render:
if (!legacyUser) return <RolePicker />
```

(ลบ `import { LoginScreen } from './pages/auth/LoginScreen'`)

---

## `src/lib/db.ts` — ไม่ต้องแก้!

โค้ดเดิมยังใช้ได้ — เพราะ Option B เก็บข้อมูลใน localStorage เหมือนเดิม (เปลี่ยนแค่วิธี auth)

---

## package.json — ลบ scripts ที่ไม่ใช้

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/query-sync-storage-persister": "^5.100.11",
    "@tanstack/react-query": "^5.100.11",
    "@tanstack/react-query-persist-client": "^5.100.11",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.5.3"
  }
}
```

(ลบ: `@supabase/supabase-js`, `concurrently`, scripts `dev:server`, `dev:all`, `server:setup`)

จากนั้นรัน:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Step-by-step

### Step 1: ลบของไม่ใช้ (15 นาที)
```bash
rm -rf server/ supabase/ src/pages/auth/
rm src/lib/supabase.ts src/lib/crud.ts
```

### Step 2: เขียน AuthContext + RolePicker ใหม่ (30 นาที)
- Copy โค้ดข้างบน

### Step 3: แก้ App.tsx (5 นาที)
- เปลี่ยน `<LoginScreen />` → `<RolePicker />`

### Step 4: ลบ Supabase dep + npm install (10 นาที)
- แก้ package.json
- `rm -rf node_modules package-lock.json && npm install`

### Step 5: Test (15 นาที)
- `npm run dev`
- เลือกบทบาท → เข้าแอป
- เพิ่มรถ → refresh → ข้อมูลยังอยู่
- F5 → ยังอยู่ในแอป (ไม่เด้งกลับ RolePicker)

---

## Verification

- [ ] Refresh แล้ว session คงอยู่ (เพราะ `kps_demo_user` ใน localStorage)
- [ ] Logout แล้ว กลับมาที่ RolePicker
- [ ] เพิ่ม/แก้/ลบข้อมูล → localStorage `kps_erp_v5` update
- [ ] เปิด incognito → ต้องเลือกบทบาทใหม่ + ข้อมูลเริ่มจาก seed ใหม่ (ไม่ sync)

---

## ข้อจำกัด (รับรู้ก่อนเลือก B)

| สถานการณ์ | ผล |
|----------|----|
| Clear cookies/localStorage | ข้อมูลหายหมด |
| เปิดในเครื่องอื่น | ข้อมูลคนละชุด |
| 2 คนใช้พร้อมกัน | ไม่เห็นข้อมูลของกันและกัน |
| Backup ข้อมูล | ต้อง export JSON เอง (ไม่มี automatic) |
| Mobile vs Desktop | ข้อมูลคนละชุด |

ถ้าต้องการแก้ข้อจำกัดเหล่านี้ → ไปทาง 🅰️ หรือ 🅲 แทน

---

## Optional: เพิ่ม Export/Import JSON

```tsx
// ในหน้า Settings:
const exportData = () => {
  const data = localStorage.getItem('kps_erp_v5')
  const blob = new Blob([data ?? '{}'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kps-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
}

const importData = (file: File) => {
  const reader = new FileReader()
  reader.onload = e => {
    localStorage.setItem('kps_erp_v5', e.target?.result as string)
    location.reload()
  }
  reader.readAsText(file)
}
```
