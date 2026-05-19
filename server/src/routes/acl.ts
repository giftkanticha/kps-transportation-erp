import { Router } from 'express'
import { AclService } from '../services/AclService'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const aclService = new AclService()

router.use(requireAuth)

router.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const users = await aclService.listUsers(req.query.status as string | undefined)
    res.json({ success: true, data: users })
  } catch (err) { next(err) }
})

router.get('/users/:userId/permissions', async (req, res, next) => {
  try {
    const perms = await aclService.getUserPermissions(req.params.userId)
    res.json({ success: true, data: perms })
  } catch (err) { next(err) }
})

router.post('/users/:userId/role', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await aclService.changeRole(req.params.userId, req.body.role, req.user!.userId)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/users/:userId/approve', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await aclService.approveUser(req.params.userId, req.user!.userId)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/users/:userId/reject', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await aclService.rejectUser(req.params.userId, req.user!.userId, req.body.reason)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/users/:userId/deactivate', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await aclService.deactivateUser(req.params.userId)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/users/:userId/activate', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await aclService.activateUser(req.params.userId)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/users/:userId/grant', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { category, actionLevel, remark } = req.body
    await aclService.grantPermission(req.params.userId, category, actionLevel, req.user!.userId, remark)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/users/:userId/revoke', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { category, actionLevel } = req.body
    await aclService.revokePermission(req.params.userId, category, actionLevel, req.user!.userId)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.get('/audit-log', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const result = await aclService.getAuditLog(page)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

export default router
