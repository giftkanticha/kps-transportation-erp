import { Router } from 'express'
import { AuthService } from '../services/AuthService'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()
const authService = new AuthService()

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, displayName, phone } = req.body
    if (!username || !password || !displayName) return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบ' })
    const result = await authService.register(username, email, password, displayName, phone)
    res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    const result = await authService.login(username, password, req.ip)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.post('/refresh-token', async (req, res, next) => {
  try {
    const result = authService.refreshToken(req.body.refreshToken)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.post('/change-password', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await authService.changePassword(req.user!.userId, req.body.oldPassword, req.body.newPassword)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.post('/set-password', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await authService.setPassword(req.user!.userId, req.body.newPassword)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, email: true, displayName: true, phone: true, role: true, status: true, lastLoginAt: true },
    })
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

export default router
