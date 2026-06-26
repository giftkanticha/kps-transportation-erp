// Thin REST client for the self-hosted MySQL backend (Express API in /server).
// Shared by the MySQL crud, realtime and auth implementations.

const ACCESS_TOKEN_KEY = 'kps_access_token'
const REFRESH_TOKEN_KEY = 'kps_refresh_token'

// Base URL of the API. Empty string = same-origin (the recommended LAN/online
// setup, where the API also serves the built frontend). For `npm run dev:all`
// set VITE_API_URL=http://localhost:3001.
export const API_URL = (import.meta.env.VITE_API_URL as string) ?? ''

export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS_TOKEN_KEY) },
  get refresh() { return localStorage.getItem(REFRESH_TOKEN_KEY) },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

interface Envelope<T> { success: boolean; data?: T; error?: string }

// Perform an authenticated request against the API and unwrap the standard
// { success, data, error } envelope. Throws a real Error with the server's
// message so callers (and the existing UI error handling) show something
// readable — mirroring the Supabase backend's toError behaviour.
export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && tokenStore.access) headers['Authorization'] = `Bearer ${tokenStore.access}`

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบว่าเปิด server แล้วและอยู่ในเครือข่ายเดียวกัน')
  }

  let json: Envelope<T>
  try {
    json = await res.json()
  } catch {
    throw new Error(`เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`)
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.error || `request failed (${res.status})`)
  }
  return json.data as T
}
