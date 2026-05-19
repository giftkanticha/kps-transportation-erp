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
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null)
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      if (s) setProfile(await fetchProfile(s.user.id))
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      setProfile(s ? await fetchProfile(s.user.id) : null)
    })
    return () => subscription.unsubscribe()
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
