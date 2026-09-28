import { createClient } from '@supabase/supabase-js'

const url  = (import.meta.env.VITE_SUPABASE_URL  as string) || 'https://placeholder.supabase.co'
const key  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key'

// Production ERP tables live in the custom `kps` Postgres schema (confirmed
// live: information_schema.tables reports user_profiles under `kps`, not
// `public` — the migrations/*.sql files in this repo are an out-of-date
// mirror). The `kps` schema must be added to Supabase Data API settings
// (Project Settings > API > Data API > Exposed schemas) or every request
// fails with "Invalid schema: kps".
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
