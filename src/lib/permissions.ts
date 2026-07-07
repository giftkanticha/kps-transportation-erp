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
  'finance', 'finance.periodClose',
  'employees', 'employees.add',
  'fuel.report', 'fuel.summary', 'fuel.reconcile', 'fuel.prices',
  'dispatch.report',  // drivers see 'dispatch.history' instead — money columns are hidden there
  'dispatch.vehicleMonthly',
  'dispatch.locations',  // master data — managers/admins curate it
  'dispatch.billing',    // money — billing notes & receivables

  // Direct vehicle-registry editing — drivers must go through the edit-approval
  // flow on the vehicles list, not this page.
  'vehicles.management',

  // Tire module — manager/admin only (matches Sidebar roles config)
  'tires', 'tires.layout', 'tires.manage', 'tires.history', 'tires.scrapped',
  // Subcontractor module — manager/admin only (exposes payment amounts)
  'subcontractors', 'subcontractors.close', 'subcontractors.history',
  'subcontractors.drivers', 'subcontractors.jobs',
  // Expenses — manager/admin only (vendor bank data, AP status)
  'expenses', 'expenses.finance', 'expenses.stock', 'expenses.report', 'expenses.vendors',
])
const ADMIN_ONLY_TOP = new Set<string>(['settings', 'admin'])

export function canAccessRoute(routeId: string, role: KPSRole): boolean {
  if (role === 'admin') return true
  const top = routeId.split('.')[0]
  if (ADMIN_ONLY_TOP.has(top)) return false
  if (role === 'manager') return true
  // driver / employee
  return !MANAGER_PLUS_ROUTES.has(routeId)
}
