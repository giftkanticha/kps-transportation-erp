// Backend-aware auth side-actions used by the auth screens. The Supabase path
// is the original behaviour verbatim; the MySQL path calls the /api/auth REST
// endpoints. Login/logout themselves live in AuthContext; this covers signup,
// self-service password change and the "clear session" escape hatch.
import { ACTIVE_BACKEND } from './backends'
import { supabase } from './supabase'
import { api, tokenStore } from './backends/mysql/api'

export interface SignUpInput {
  username: string
  email: string
  password: string
  displayName: string
  phone: string
}

export async function signUp(input: SignUpInput): Promise<void> {
  if (ACTIVE_BACKEND === 'mysql') {
    await api('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        username: input.username.trim().toLowerCase(),
        email: input.email.trim() || undefined,
        password: input.password,
        displayName: input.displayName.trim(),
        phone: input.phone.trim(),
      },
    })
    return
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        display_name: input.displayName.trim(),
        phone: input.phone.trim(),
        username: input.username.trim().toLowerCase(),
      },
    },
  })
  if (error) throw new Error(error.message)
  // Supabase returns status 200 even when the email is already in use
  // (anti-enumeration). The signal is data.user.identities being empty.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    throw new Error('อีเมลนี้ถูกใช้สมัครไปแล้ว — กรุณาเข้าสู่ระบบ หรือใช้ "ลืมรหัสผ่าน" เพื่อตั้งใหม่')
  }
}

// Change the current user's password (relies on the active session/token).
export async function changeOwnPassword(newPassword: string): Promise<void> {
  if (ACTIVE_BACKEND === 'mysql') {
    await api('/api/auth/set-password', { method: 'POST', body: { newPassword } })
    return
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

// Clear the local session ("clear session" button / hard logout).
export async function signOutEverywhere(): Promise<void> {
  if (ACTIVE_BACKEND === 'mysql') {
    tokenStore.clear()
    return
  }
  try { await supabase.auth.signOut() } catch { /* ignore */ }
}
