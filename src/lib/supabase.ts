import { createClient } from '@supabase/supabase-js'

const url  = (import.meta.env.VITE_SUPABASE_URL  as string) || 'https://placeholder.supabase.co'
const key  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key'

// Real Supabase client is still constructed (so non-bypass code paths work
// when env vars ARE provided). The DEV BYPASS in AuthContext short-circuits
// before any Supabase call happens, so placeholder values are never hit.
export const supabase = createClient(url, key)

export type UserRole   = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'LOCKED'

export interface UserProfile {
  id:           string
  display_name: string
  phone:        string
  role:         UserRole
  status:       UserStatus
  approved_by:  string | null
  approved_at:  string | null
  created_at:   string
  updated_at:   string
}
