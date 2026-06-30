// Backend-aware loader that returns user rows in the SAME snake_case shape the
// Supabase `user_profiles` table exposes, so the admin/ACL pages can render
// either backend without changing their JSX field reads.
//
// - supabase mode: read directly from `user_profiles`.
// - mysql mode: users live in the `User` table, exposed via `/api/acl/users`
//   (camelCase). We map the server fields back to the snake_case shape.
import { ACTIVE_BACKEND } from './backends'
import { supabase } from './supabase'
import { api } from './backends/mysql/api'

// The snake_case row shape the pages consume (subset of user_profiles columns).
export interface AclUserRow {
  id: string
  display_name: string
  username: string | null
  email: string | null
  phone: string
  role: string
  status: string
  approved_at: string | null
  created_at: string
  [key: string]: unknown
}

// Camel-case shape returned by AclService.listUsers (server).
interface ServerUser {
  id: string
  username: string | null
  email: string | null
  displayName: string
  phone: string
  role: string
  status: string
  lastLoginAt: string | null
  createdAt: string
  approvedAt: string | null
  approvedBy: string | null
}

function mapServerUser(u: ServerUser): AclUserRow {
  return {
    id: u.id,
    display_name: u.displayName,
    username: u.username,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    approved_at: u.approvedAt,
    created_at: u.createdAt,
  }
}

// Load every user, newest first, in the snake_case shape.
export async function loadAclUsers(): Promise<AclUserRow[]> {
  if (ACTIVE_BACKEND === 'mysql') {
    const users = await api<ServerUser[]>('/api/acl/users')
    return users.map(mapServerUser)
  }
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return (data || []) as unknown as AclUserRow[]
}
