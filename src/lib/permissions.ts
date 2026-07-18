import type { KPSRole, User } from '../types'

export const can = {
  editVehicle(role: KPSRole): boolean {
    return role === 'admin' || role === 'manager'
  },
  deleteVehicle(role: KPSRole): boolean {
    return role === 'admin'
  },
  reviewApprovals(role: KPSRole): boolean {
    return role === 'admin' || role === 'manager'
  },
  requestVehicleEdit(role: KPSRole): boolean {
    return role === 'driver'
  },
}

export const roleLabel = (role: KPSRole): string => {
  if (role === 'admin') return 'ผู้ดูแลระบบ'
  if (role === 'manager') return 'ผู้จัดการ'
  return 'พนักงาน'
}

export const roleBadgeColor = (role: KPSRole): string => {
  if (role === 'admin') return 'var(--primary)'
  if (role === 'manager') return '#7c3aed'
  return 'var(--text-2)'
}

export const isPrivileged = (user: User | null | undefined): boolean =>
  !!user && (user.role === 'admin' || user.role === 'manager')

// ── Menu / route access ──────────────────────────────────────────────
// Routes hidden from drivers/employees: dashboard, finance, staff data,
// and all summary/report pages. Managers see everything except settings/admin.
const MANAGER_PLUS_ROUTES = new Set<string>([
  'dashboard',
  'finance', 'finance.aging', 'finance.periodClose',
  'employees', 'employees.add',
  'fuel.report', 'fuel.summary', 'fuel.reconcile', 'fuel.prices',
  'dispatch.report',  // drivers see 'dispatch.history' instead — money columns are hidden there
  'dispatch.vehicleMonthly',
  'dispatch.locations',  // master data — managers/admins curate it
  'dispatch.billing',    // money — billing notes & receivables

  'expenses.finance', 'expenses.report',
])
const ADMIN_ONLY_TOP = new Set<string>(['settings', 'admin'])

// Top-level menus an admin can grant/restrict per user (สิทธิ์การเข้าเมนู).
// Order matches the sidebar and drives firstAllowedPath's redirect target.
// settings/admin are omitted — they stay admin-only regardless of this list.
export const ASSIGNABLE_MENUS: { key: string; label: string }[] = [
  { key: 'dashboard',      label: 'Dashboard' },
  { key: 'vehicles',       label: 'จัดการรถ' },
  { key: 'employees',      label: 'ข้อมูลพนักงาน' },
  { key: 'tires',          label: 'ระบบยาง' },
  { key: 'fuel',           label: 'ระบบน้ำมัน' },
  { key: 'dispatch',       label: 'งานขนส่ง' },
  { key: 'subcontractors', label: 'รถรับจ้างร่วม' },
  { key: 'expenses',       label: 'ค่าใช้จ่าย' },
  { key: 'finance',        label: 'การเงิน' },
]

// `allowedKeys` = per-user menu restriction (top-level menu ids):
//   null/undefined → unrestricted (see everything the role allows)
//   array          → only routes whose top-level menu id is in the set
// Sub-routes inherit their parent (top segment) permission. Applies on top of
// the role gate, so a restricted manager still can't reach admin-only routes.
export function canAccessRoute(routeId: string, role: KPSRole, allowedKeys?: string[] | null): boolean {
  if (role === 'admin') return true
  const top = routeId.split('.')[0]
  if (ADMIN_ONLY_TOP.has(top)) return false
  if (allowedKeys != null && !allowedKeys.includes(top)) return false
  if (role === 'manager') return true
  // driver / employee
  return !MANAGER_PLUS_ROUTES.has(routeId)
}

// First route (in sidebar order) this user can actually open — used to redirect
// away from a landing route they have no access to. Falls back to 'dashboard'.
export function firstAllowedPath(role: KPSRole, allowedKeys?: string[] | null): string {
  const found = ASSIGNABLE_MENUS.find(m => canAccessRoute(m.key, role, allowedKeys))
  return found?.key ?? 'dashboard'
}
