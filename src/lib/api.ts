const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('kps_access_token')
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('kps_access_token', access)
  localStorage.setItem('kps_refresh_token', refresh)
}

function clearTokens() {
  localStorage.removeItem('kps_access_token')
  localStorage.removeItem('kps_refresh_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }
  let res: Response
  try {
    res = await fetch(BASE + path, { ...options, headers })
  } catch {
    throw new Error('ไม่สามารถเชื่อมต่อกับ server ได้ — กรุณารอสักครู่แล้วลองใหม่')
  }
  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('ไม่สามารถเชื่อมต่อกับ server ได้ — กรุณารอสักครู่แล้วลองใหม่')
  }
  if (!data.success) throw new Error(data.error || 'Request failed')
  return data.data as T
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ accessToken: string; refreshToken: string; user: ApiUser }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
      }),

    register: (body: { username: string; email?: string; password: string; displayName: string; phone?: string }) =>
      request<{ id: string; username: string; status: string }>('/auth/register', {
        method: 'POST', body: JSON.stringify(body),
      }),

    me: () => request<ApiUser>('/auth/me'),

    changePassword: (oldPassword: string, newPassword: string) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST', body: JSON.stringify({ oldPassword, newPassword }),
      }),

    forgotPassword: (email: string) =>
      request<{ message: string; token: string | null }>('/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, newPassword: string) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST', body: JSON.stringify({ token, newPassword }),
      }),
  },

  acl: {
    listUsers: (status?: string) =>
      request<ApiUser[]>('/acl/users' + (status ? `?status=${status}` : '')),

    getPermissions: (userId: string) =>
      request<Permission[]>(`/acl/users/${userId}/permissions`),

    approve: (userId: string) =>
      request<void>(`/acl/users/${userId}/approve`, { method: 'POST' }),

    reject: (userId: string, reason?: string) =>
      request<void>(`/acl/users/${userId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

    deactivate: (userId: string) =>
      request<void>(`/acl/users/${userId}/deactivate`, { method: 'POST' }),

    activate: (userId: string) =>
      request<void>(`/acl/users/${userId}/activate`, { method: 'POST' }),

    changeRole: (userId: string, role: string) =>
      request<void>(`/acl/users/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) }),

    grantPermission: (userId: string, category: string, actionLevel: string, remark?: string) =>
      request<void>(`/acl/users/${userId}/grant`, { method: 'POST', body: JSON.stringify({ category, actionLevel, remark }) }),

    revokePermission: (userId: string, category: string, actionLevel: string) =>
      request<void>(`/acl/users/${userId}/revoke`, { method: 'POST', body: JSON.stringify({ category, actionLevel }) }),

    auditLog: (page = 1) =>
      request<{ logs: AuditEntry[]; total: number; pages: number }>(`/acl/audit-log?page=${page}`),
  },

  reset: {
    log: (details: string) =>
      request<{ id: string }>('/reset/log', { method: 'POST', body: JSON.stringify({ details }) }),

    history: () =>
      request<ResetEntry[]>('/reset/history'),
  },

  setTokens,
  clearTokens,
  getToken,
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ApiUser {
  id: string
  username: string
  email: string | null
  displayName: string
  phone?: string | null
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  status: string
  lastLoginAt?: string | null
  createdAt?: string
  approvedAt?: string | null
  approvedBy?: string | null
}

export interface Permission {
  category: string
  actionLevel: string
  isOverride: boolean
  source: 'role' | 'custom'
}

export interface AuditEntry {
  id: string
  action: string
  category?: string
  actionLevel?: string
  oldValue?: string
  newValue?: string
  details?: string
  ipAddress?: string
  createdAt: string
  user?: { username: string; displayName: string }
}

export interface ResetEntry {
  id: string
  resetBy: string
  resetType: string
  details?: string
  status: string
  createdAt: string
  completedAt?: string
}
