import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type UserProfile, type UserRole } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import type { User, KPSRole } from '../types'

// ─── DEV BYPASS ─────────────────────────────────────────────────────────────
// When true, skip Supabase auth entirely and use a hardcoded admin user.
// Survives page refresh, no login required.
// Flip back to false (or remove this block) when re-enabling auth.
const BYPASS_AUTH = false

const BYPASS_USER: User = {
  id: 'dev-admin',
  email: 'dev@kps.local',
  name: 'KPS Admin (Dev)',
  role: 'admin',
  avatar: '👑',
  phone: '',
  title: 'Super Admin',
}
const BYPASS_PROFILE: UserProfile = {
  id: 'dev-admin',
  display_name: 'KPS Admin (Dev)',
  phone: '',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  approved_by: null,
  approved_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  email: 'dev@kps.local',
  username: 'dev',
}
// ────────────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session:    Session | null
  profile:    UserProfile | null
  legacyUser: User | null
  loading:    boolean
  recoveryMode: boolean
  login:      (email: string, password: string) => Promise<void>
  logout:     () => Promise<void>
  exitRecovery: () => void
  isAdmin:    boolean
  isManager:  boolean
  isSuperAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ROLE_MAP: Record<UserRole, KPSRole> = {
  SUPER_ADMIN: 'admin',
  ADMIN:       'admin',
  MANAGER:     'manager',
  EMPLOYEE:    'driver',
}
const AVATAR_MAP: Record<UserRole, string> = {
  SUPER_ADMIN: '👑', ADMIN: '🛡️', MANAGER: '📋', EMPLOYEE: '👤',
}

function toLegacy(profile: UserProfile, email: string): User {
  return {
    id:     profile.id,
    email,
    name:   profile.display_name,
    role:   ROLE_MAP[profile.role] ?? 'driver',
    avatar: AVATAR_MAP[profile.role] ?? '👤',
    phone:  profile.phone,
    title:  profile.role === 'SUPER_ADMIN' ? 'Super Admin'
          : profile.role === 'ADMIN'       ? 'Admin'
          : profile.role === 'MANAGER'     ? 'Manager' : 'Employee',
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return data as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]       = useState<Session | null>(null)
  const [profile, setProfile]       = useState<UserProfile | null>(BYPASS_AUTH ? BYPASS_PROFILE : null)
  const [loading, setLoading]       = useState(!BYPASS_AUTH)
  const [recoveryMode, setRecovery] = useState(false)

  useEffect(() => {
    if (BYPASS_AUTH) return
    let mounted = true

    const loadProfile = async (s: Session | null) => {
      if (!mounted) return
      setSession(s)
      if (!s) { setProfile(null); return }
      try {
        setProfile(await fetchProfile(s.user.id))
      } catch {
        // Network/RLS hiccup — keep the session, don't hard-kick the user
        setProfile(null)
      }
    }

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => loadProfile(s))
      .catch(() => { /* offline / auth unreachable — fall through to login */ })
      .finally(() => { if (mounted) setLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // PASSWORD_RECOVERY fires when a user arrives via the password-reset
      // email link — they hold a short-lived recovery session, so we route
      // them to the ResetPasswordScreen until they set a new password.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      void loadProfile(s)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    if (BYPASS_AUTH) return
    let email = identifier.trim()
    // Allow logging in with a username: resolve it to the account email first.
    if (!email.includes('@')) {
      const { data: resolved, error: rpcErr } = await supabase.rpc('email_for_username', { p_username: email })
      if (rpcErr) throw new Error(rpcErr.message)
      if (!resolved) throw new Error('ไม่พบชื่อผู้ใช้นี้')
      email = resolved as string
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' : error.message)
    const p = await fetchProfile(data.user.id)
    if (p?.status === 'PENDING_APPROVAL') {
      await supabase.auth.signOut()
      throw new Error('บัญชีของคุณรอการอนุมัติจาก Admin')
    }
    if (p?.status === 'INACTIVE' || p?.status === 'LOCKED') {
      await supabase.auth.signOut()
      throw new Error('บัญชีของคุณถูกระงับการใช้งาน')
    }
    setProfile(p)
  }, [])

  const logout = useCallback(async () => {
    if (BYPASS_AUTH) {
      // eslint-disable-next-line no-alert
      alert('Auth bypass อยู่ — ปิด BYPASS_AUTH ใน AuthContext.tsx เพื่อ logout ได้จริง')
      return
    }
    await supabase.auth.signOut()
    // Drop all cached query data (in memory + the persisted localStorage copy)
    // so the next user on a shared device can't see the previous user's
    // financial data lingering for the persister's 24h maxAge.
    queryClient.clear()
    try { localStorage.removeItem('kps_query_cache_v1') } catch { /* ignore */ }
  }, [])

  const exitRecovery = useCallback(() => setRecovery(false), [])

  const legacyUser = BYPASS_AUTH
    ? BYPASS_USER
    : (session && profile && profile.status === 'ACTIVE'
        ? toLegacy(profile, session.user.email ?? '')
        : null)

  return (
    <AuthContext.Provider value={{
      session, profile, legacyUser, loading, recoveryMode, login, logout, exitRecovery,
      isAdmin:      BYPASS_AUTH || profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN',
      isManager:    BYPASS_AUTH || profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'MANAGER',
      isSuperAdmin: BYPASS_AUTH || profile?.role === 'SUPER_ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
