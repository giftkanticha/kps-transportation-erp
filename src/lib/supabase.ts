import { createClient } from '@supabase/supabase-js'

const url  = (import.meta.env.VITE_SUPABASE_URL  as string) || 'https://placeholder.supabase.co'
const key  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key'

// Production ERP tables are stored in the custom kps schema.
// The schema must also be enabled in Supabase Data API settings.
export const supabase = createClient(url, key, {
  db: { schema: 'kps' }
})

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
  email:        string | null
  username:     string | null
}
