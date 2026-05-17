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
