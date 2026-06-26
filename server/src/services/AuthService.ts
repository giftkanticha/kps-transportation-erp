import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'kps-erp-secret'
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'kps-refresh-secret'

export class AuthService {
  async register(username: string, email: string | undefined, password: string, displayName: string, phone?: string) {
    const conditions: any[] = [{ username }]
    if (email) conditions.push({ email })
    const existing = await prisma.user.findFirst({ where: { OR: conditions } })
    if (existing) throw new Error('Username หรือ Email ซ้ำแล้ว')
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username, email: email || null, passwordHash, displayName, phone, status: 'PENDING_APPROVAL', role: 'EMPLOYEE' },
    })
    return { id: user.id, username: user.username, status: user.status }
  }

  async login(username: string, password: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({ where: { username } })

    if (!user) {
      await prisma.loginHistory.create({ data: { userId: 'unknown', ipAddress, success: false, failureReason: 'User not found' } }).catch(() => {})
      throw new Error('Username หรือ password ผิด')
    }

    if (user.status === 'PENDING_APPROVAL') {
      await prisma.loginHistory.create({ data: { userId: user.id, ipAddress, success: false, failureReason: 'Account pending approval' } })
      throw new Error('บัญชีของคุณรอการอนุมัติจาก Admin')
    }

    if (user.status === 'INACTIVE') {
      await prisma.loginHistory.create({ data: { userId: user.id, ipAddress, success: false, failureReason: 'Account inactive' } })
      throw new Error('บัญชีของคุณถูกปิดไว้')
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      await prisma.loginHistory.create({ data: { userId: user.id, ipAddress, success: false, failureReason: 'Account locked' } })
      throw new Error('บัญชีถูกล็อค กรุณารอ 15 นาทีแล้วลองใหม่')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      const newCount = user.failedLoginCount + 1
      const updates: any = { failedLoginCount: newCount }
      if (newCount >= 3) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
        updates.status = 'LOCKED'
      }
      await prisma.user.update({ where: { id: user.id }, data: updates })
      await prisma.loginHistory.create({ data: { userId: user.id, ipAddress, success: false, failureReason: 'Invalid password' } })
      throw new Error('Username หรือ password ผิด')
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } })
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' })
    const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' })
    await prisma.loginHistory.create({ data: { userId: user.id, ipAddress, success: true } })

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, email: user.email },
    }
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findFirst({ where: { email } })
    if (!user) return { message: 'ถ้า email มีในระบบ link จะถูกส่ง', token: null }
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } })
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } })
    return { message: 'สร้าง reset token แล้ว', token }
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await prisma.passwordReset.findUnique({ where: { token }, include: { user: true } })
    if (!reset) throw new Error('Token ไม่ถูกต้อง')
    if (new Date() > reset.expiresAt) throw new Error('Token หมดอายุแล้ว')
    if (reset.usedAt) throw new Error('Token ถูกใช้ไปแล้ว')
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } })
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
    return { message: 'เปลี่ยน password สำเร็จ' }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('User not found')
    const valid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!valid) throw new Error('Password เดิมไม่ถูกต้อง')
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    return { message: 'เปลี่ยน password สำเร็จ' }
  }

  // Set a new password for the already-authenticated user (no old password
  // required) — the REST equivalent of Supabase's updateUser({ password }),
  // which likewise relies on the active session rather than the old password.
  async setPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    return { message: 'เปลี่ยน password สำเร็จ' }
  }

  verifyToken(token: string): { userId: string; role: string } {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string }
  }

  refreshToken(refreshToken: string) {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string }
    return { accessToken: jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: '24h' }) }
  }
}
