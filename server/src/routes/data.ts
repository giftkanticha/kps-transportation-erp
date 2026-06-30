import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { emitChange } from '../lib/realtime'
import { getTableConfig, toPrismaInput, toWireRow, orderField } from '../lib/tables'

const router = Router()

// Generic CRUD over whitelisted operational tables. Maps 1:1 onto the
// frontend crud.ts functions. The wire format matches Supabase's PostgREST
// output (snake_case rows) so the MySQL frontend adapter is a drop-in.
router.use(requireAuth)

// Resolve the Prisma delegate for a table, or 404 if not whitelisted.
function resolve(table: string) {
  const cfg = getTableConfig(table)
  if (!cfg) return null
  const delegate = (prisma as any)[cfg.delegate]
  if (!delegate) return null
  return { cfg, delegate }
}

// GET /api/data/:table?orderBy=&ascending=
router.get('/:table', async (req, res, next) => {
  try {
    const found = resolve(req.params.table)
    if (!found) return res.status(404).json({ success: false, error: 'Unknown table' })
    const { cfg, delegate } = found

    const orderByCol = (req.query.orderBy as string) || 'created_at'
    const ascending = req.query.ascending === 'true'
    const field = orderField(cfg, orderByCol)
    const args: any = {}
    if (field) args.orderBy = { [field]: ascending ? 'asc' : 'desc' }

    const rows = await delegate.findMany(args)
    res.json({ success: true, data: rows.map((r: any) => toWireRow(cfg, r)) })
  } catch (err) { next(err) }
})

// GET /api/data/:table/:id
router.get('/:table/:id', async (req, res, next) => {
  try {
    const found = resolve(req.params.table)
    if (!found) return res.status(404).json({ success: false, error: 'Unknown table' })
    const { cfg, delegate } = found
    const row = await delegate.findUnique({ where: { id: req.params.id } })
    res.json({ success: true, data: row ? toWireRow(cfg, row) : null })
  } catch (err) { next(err) }
})

// POST /api/data/:table
router.post('/:table', async (req, res, next) => {
  try {
    const found = resolve(req.params.table)
    if (!found) return res.status(404).json({ success: false, error: 'Unknown table' })
    const { cfg, delegate } = found
    const data = toPrismaInput(cfg, req.body ?? {})
    const row = await delegate.create({ data })
    emitChange(cfg.table)
    res.status(201).json({ success: true, data: toWireRow(cfg, row) })
  } catch (err) { next(err) }
})

// PATCH /api/data/:table/:id
router.patch('/:table/:id', async (req, res, next) => {
  try {
    const found = resolve(req.params.table)
    if (!found) return res.status(404).json({ success: false, error: 'Unknown table' })
    const { cfg, delegate } = found
    const data = toPrismaInput(cfg, req.body ?? {})
    const row = await delegate.update({ where: { id: req.params.id }, data })
    emitChange(cfg.table)
    res.json({ success: true, data: toWireRow(cfg, row) })
  } catch (err) { next(err) }
})

// DELETE /api/data/:table/:id
router.delete('/:table/:id', async (req, res, next) => {
  try {
    const found = resolve(req.params.table)
    if (!found) return res.status(404).json({ success: false, error: 'Unknown table' })
    const { cfg, delegate } = found
    await delegate.delete({ where: { id: req.params.id } })
    emitChange(cfg.table)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

export default router
