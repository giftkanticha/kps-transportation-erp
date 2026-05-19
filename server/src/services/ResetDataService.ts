import { prisma } from '../lib/prisma'

export class ResetDataService {
  async logReset(resetBy: string, details: string, ipAddress?: string) {
    const log = await prisma.dataResetLog.create({
      data: { resetBy, resetType: 'MANUAL', details, status: 'COMPLETED', completedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: { userId: resetBy, action: 'DATA_RESET', details, ipAddress },
    })
    return log
  }

  async getResetHistory() {
    return prisma.dataResetLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  }
}
