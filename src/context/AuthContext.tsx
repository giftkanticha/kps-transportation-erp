import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type UserProfile, type UserRole } from '../lib/supabase'
import type { User, KPSRole } from '../types'
import { ACTIVE_BACKEND } from '../lib/backends'
import { api, tokenStore } from '../lib/backends/mysql/api'
import { resetSocket } from '../lib/backends/mysql/realtime'

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

function roleFlags(profile: UserProfile | null) {
  return {
    isAdmin:      profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN',
    isManager:    profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'MANAGER',
    isSuperAdmin: profile?.role === 'SUPER_ADMIN',
  }
}

// ─── Supabase provider (original behaviour, unchanged) ───────────────────────
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return data as UserProfile | null
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
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
      ...roleFlags(BYPASS_AUTH ? BYPASS_PROFILE : profile),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── MySQL provider (self-hosted REST backend) ───────────────────────────────
interface MeResponse {
  id: string; username: string | null; email: string | null
  displayName: string; phone: string | null; role: UserRole; status: UserProfile['status']
}

function profileFromMe(me: MeResponse): UserProfile {
  return {
    id: me.id,
    display_name: me.displayName,
    phone: me.phone ?? '',
    role: me.role,
    status: me.status,
    approved_by: null,
    approved_at: null,
    created_at: '',
    updated_at: '',
    email: me.email ?? null,
    username: me.username ?? null,
  }
}

// Synthesize the minimal Session shape the rest of the app reads (user.id/email).
function synthSession(me: MeResponse): Session {
  return { user: { id: me.id, email: me.email ?? '' } } as unknown as Session
}

function MysqlAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    if (!tokenStore.access) { setLoading(false); return }
    api<MeResponse>('/api/auth/me')
      .then((me) => {
        if (!mounted) return
        if (me.status !== 'ACTIVE') { tokenStore.clear(); return }
        setSession(synthSession(me))
        setProfile(profileFromMe(me))
      })
      .catch(() => { tokenStore.clear() })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api<{ accessToken: string; refreshToken: string; user: MeResponse }>(
      '/api/auth/login', { method: 'POST', auth: false, body: { username: identifier.trim(), password } },
    )
    tokenStore.set(data.accessToken, data.refreshToken)
    // login already rejects non-active accounts server-side; fetch full profile.
    const me = await api<MeResponse>('/api/auth/me')
    await resetSocket()
    setSession(synthSession(me))
    setProfile(profileFromMe(me))
  }, [])

  const logout = useCallback(async () => {
    tokenStore.clear()
    await resetSocket()
    setSession(null)
    setProfile(null)
  }, [])

  const exitRecovery = useCallback(() => {}, [])

  const legacyUser = session && profile && profile.status === 'ACTIVE'
    ? toLegacy(profile, session.user.email ?? '')
    : null

  return (
    <AuthContext.Provider value={{
      session, profile, legacyUser, loading, recoveryMode: false, login, logout, exitRecovery,
      ...roleFlags(profile),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Build-time selection: the Supabase path is unchanged; 'mysql' uses the
// self-hosted REST auth. Each provider unconditionally calls its own hooks, so
// rules-of-hooks are satisfied (ACTIVE_BACKEND is a build constant).
export function AuthProvider({ children }: { children: ReactNode }) {
  return ACTIVE_BACKEND === 'mysql'
    ? <MysqlAuthProvider>{children}</MysqlAuthProvider>
    : <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
