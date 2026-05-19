import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api, type ApiUser } from '../lib/api'
import type { User, KPSRole } from '../types'

interface AuthContextValue {
  authUser: ApiUser | null
  legacyUser: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isSuperAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function mapToLegacyUser(u: ApiUser): User {
  const roleMap: Record<string, KPSRole> = {
    SUPER_ADMIN: 'admin',
    ADMIN: 'admin',
    MANAGER: 'manager',
    EMPLOYEE: 'driver',
  }
  return {
    id: u.id,
    email: u.email || '',
    name: u.displayName,
    role: roleMap[u.role] ?? 'driver',
    avatar: u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' ? '👑' : u.role === 'MANAGER' ? '📋' : '👤',
    phone: u.phone || '',
    title: u.role === 'SUPER_ADMIN' ? 'Super Admin' : u.role === 'ADMIN' ? 'Admin' : u.role === 'MANAGER' ? 'Manager' : 'Employee',
  }
}

function loadStoredUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem('kps_auth_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<ApiUser | null>(loadStoredUser)
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    try {
      const result = await api.auth.login(username, password)
      api.setTokens(result.accessToken, result.refreshToken)
      localStorage.setItem('kps_auth_user', JSON.stringify(result.user))
      setAuthUser(result.user)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    api.clearTokens()
    localStorage.removeItem('kps_auth_user')
    setAuthUser(null)
  }, [])

  const legacyUser = authUser ? mapToLegacyUser(authUser) : null

  return (
    <AuthContext.Provider value={{
      authUser,
      legacyUser,
      loading,
      login,
      logout,
      isAdmin: authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN',
      isSuperAdmin: authUser?.role === 'SUPER_ADMIN',
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
