import { prisma } from '../lib/prisma'

export const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'FLEET_MANAGEMENT:VIEW','FLEET_MANAGEMENT:CREATE','FLEET_MANAGEMENT:EDIT','FLEET_MANAGEMENT:DELETE_APPROVE',
    'TIRE_LIFECYCLE:VIEW','TIRE_LIFECYCLE:CREATE','TIRE_LIFECYCLE:EDIT','TIRE_LIFECYCLE:DELETE_APPROVE',
    'FUEL_EXPENSES:VIEW','FUEL_EXPENSES:CREATE','FUEL_EXPENSES:EDIT','FUEL_EXPENSES:DELETE_APPROVE',
    'PARTNER_FINANCIALS:VIEW','PARTNER_FINANCIALS:CREATE','PARTNER_FINANCIALS:EDIT','PARTNER_FINANCIALS:DELETE_APPROVE',
    'USER_MANAGEMENT:VIEW','USER_MANAGEMENT:CREATE','USER_MANAGEMENT:EDIT','USER_MANAGEMENT:DELETE_APPROVE',
  ],
  ADMIN: [
    'FLEET_MANAGEMENT:VIEW','FLEET_MANAGEMENT:CREATE','FLEET_MANAGEMENT:EDIT','FLEET_MANAGEMENT:DELETE_APPROVE',
    'TIRE_LIFECYCLE:VIEW','TIRE_LIFECYCLE:CREATE','TIRE_LIFECYCLE:EDIT','TIRE_LIFECYCLE:DELETE_APPROVE',
    'FUEL_EXPENSES:VIEW','FUEL_EXPENSES:CREATE','FUEL_EXPENSES:EDIT','FUEL_EXPENSES:DELETE_APPROVE',
    'PARTNER_FINANCIALS:VIEW','PARTNER_FINANCIALS:CREATE','PARTNER_FINANCIALS:EDIT',
    'USER_MANAGEMENT:VIEW','USER_MANAGEMENT:CREATE','USER_MANAGEMENT:EDIT',
  ],
  MANAGER: [
    'FLEET_MANAGEMENT:VIEW','FLEET_MANAGEMENT:CREATE','FLEET_MANAGEMENT:EDIT',
    'TIRE_LIFECYCLE:VIEW','TIRE_LIFECYCLE:CREATE','TIRE_LIFECYCLE:EDIT',
    'FUEL_EXPENSES:VIEW','FUEL_EXPENSES:CREATE','FUEL_EXPENSES:EDIT',
    'PARTNER_FINANCIALS:VIEW','PARTNER_FINANCIALS:CREATE',
    'USER_MANAGEMENT:VIEW',
  ],
  EMPLOYEE: [
    'FLEET_MANAGEMENT:VIEW',
    'TIRE_LIFECYCLE:VIEW',
    'FUEL_EXPENSES:VIEW','FUEL_EXPENSES:CREATE',
    'PARTNER_FINANCIALS:VIEW',
  ],
}

export class AclService {
  async getUserPermissions(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (!user) throw new Error('User not found')
    const defaults = (ROLE_DEFAULTS[user.role] || []).map(p => {
      const [category, actionLevel] = p.split(':')
      return { category, actionLevel, isOverride: false, source: 'role' as const }
    })
    const overrides = await prisma.rolePermission.findMany({ where: { userId } })
    const map = new Map<string, any>()
    defaults.forEach(p => map.set(`${p.category}:${p.actionLevel}`, p))
    overrides.forEach(p => map.set(`${p.category}:${p.actionLevel}`, { ...p, source: 'custom' }))
    return Array.from(map.values())
  }

  async hasPermission(userId: string, category: string, actionLevel: string) {
    const perms = await this.getUserPermissions(userId)
    return perms.some(p => p.category === category && p.actionLevel === actionLevel)
  }

  async grantPermission(userId: string, category: string, actionLevel: string, grantedBy: string, remark?: string) {
    await prisma.rolePermission.upsert({
      where: { userId_category_actionLevel: { userId, category, actionLevel } },
      create: { userId, category, actionLevel, grantedBy, remark, isOverride: true },
      update: { grantedBy, remark, grantedAt: new Date() },
    })
    await prisma.auditLog.create({ data: { userId, action: 'PERMISSION_GRANTED', category, actionLevel, newValue: `${category}:${actionLevel}`, details: remark } })
  }

  async revokePermission(userId: string, category: string, actionLevel: string, revokedBy: string) {
    await prisma.rolePermission.deleteMany({ where: { userId, category, actionLevel } })
    await prisma.auditLog.create({ data: { userId, action: 'PERMISSION_REVOKED', category, actionLevel } })
  }

  async changeRole(userId: string, newRole: string, changedBy: string) {
    const old = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    await prisma.user.update({ where: { id: userId }, data: { role: newRole } })
    await prisma.auditLog.create({ data: { userId, action: 'ROLE_CHANGED', oldValue: old?.role, newValue: newRole } })
  }

  async approveUser(userId: string, approvedBy: string) {
    await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE', approvedBy, approvedAt: new Date() } })
    await prisma.auditLog.create({ data: { userId, action: 'USER_APPROVED', newValue: 'ACTIVE' } })
  }

  async rejectUser(userId: string, rejectedBy: string, reason?: string) {
    await prisma.auditLog.create({ data: { userId, action: 'USER_REJECTED', details: reason } })
    await prisma.user.delete({ where: { id: userId } })
  }

  async deactivateUser(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { status: 'INACTIVE' } })
    await prisma.auditLog.create({ data: { userId, action: 'USER_DEACTIVATED' } })
  }

  async activateUser(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null } })
    await prisma.auditLog.create({ data: { userId, action: 'USER_ACTIVATED' } })
  }

  async listUsers(status?: string) {
    return prisma.user.findMany({
      where: status ? { status } : undefined,
      select: { id: true, username: true, email: true, displayName: true, phone: true, role: true, status: true, lastLoginAt: true, createdAt: true, approvedAt: true, approvedBy: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getAuditLog(page = 1, limit = 50) {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { user: { select: { username: true, displayName: true } } } }),
    ])
    return { logs, total, pages: Math.ceil(total / limit) }
  }
}
