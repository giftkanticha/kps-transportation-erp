import { Router } from 'express'
import { ResetDataService } from '../services/ResetDataService'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const resetService = new ResetDataService()

router.post('/log', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const result = await resetService.logReset(req.user!.userId, req.body.details, req.ip)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

router.get('/history', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const history = await resetService.getResetHistory()
    res.json({ success: true, data: history })
  } catch (err) { next(err) }
})

export default router
