import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type UserProfile, type UserRole } from '../lib/supabase'
import type { User, KPSRole } from '../types'

interface AuthContextValue {
  session:    Session | null
  profile:    UserProfile | null
  legacyUser: User | null
  loading:    boolean
  login:      (email: string, password: string) => Promise<void>
  logout:     () => Promise<void>
  isAdmin:    boolean
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
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('[auth] fetchProfile failed:', error.message)
    return null
  }
  return data as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null)
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false
    // Safety net: never leave the user staring at a disabled login button.
    // If anything in the init path hangs (network, Supabase outage, etc.),
    // force the loading state off after 6s so they can at least attempt a login.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('[auth] init timed out after 6s — releasing loading state')
        setLoading(false)
      }
    }, 6000)

    ;(async () => {
      console.log('[auth] init: calling getSession')
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession()
        if (error) console.error('[auth] getSession error:', error)
        console.log('[auth] init: getSession resolved, session?', !!s)
        if (cancelled) return
        setSession(s)
        if (s) {
          const p = await fetchProfile(s.user.id)
          console.log('[auth] init: fetchProfile resolved, profile?', !!p, 'status:', p?.status)
          if (!cancelled) setProfile(p)
        }
      } catch (e) {
        console.error('[auth] init flow threw:', e)
      } finally {
        clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log('[auth] onAuthStateChange:', event, 'session?', !!s)
      if (cancelled) return
      setSession(s)
      setProfile(s ? await fetchProfile(s.user.id) : null)
    })
    return () => { cancelled = true; clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email หรือ password ไม่ถูกต้อง' : error.message)
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
    await supabase.auth.signOut()
  }, [])

  const legacyUser = session && profile && profile.status === 'ACTIVE'
    ? toLegacy(profile, session.user.email ?? '')
    : null

  return (
    <AuthContext.Provider value={{
      session, profile, legacyUser, loading, login, logout,
      isAdmin:      profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN',
      isSuperAdmin: profile?.role === 'SUPER_ADMIN',
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
