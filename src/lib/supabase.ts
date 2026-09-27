import { createClient } from '@supabase/supabase-js'

const url  = (import.meta.env.VITE_SUPABASE_URL  as string) || 'https://placeholder.supabase.co'
const key  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key'

// All ERP tables live in the default `public` schema (see supabase/migrations/
// and supabase/auth-schema.sql — none of them create or reference a `kps`
// schema). Do NOT set db.schema to anything else here: PostgREST rejects
// requests for a schema that isn't exposed in Data API settings with
// "Invalid schema: <name>", which breaks every query and login.
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
  email:        string | null
  username:     string | null
}
