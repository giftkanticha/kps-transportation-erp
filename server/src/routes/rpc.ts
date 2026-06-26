import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { emitChange } from '../lib/realtime'
import { getTableConfig } from '../lib/tables'

// Reimplementation of the Postgres SECURITY DEFINER RPCs as REST endpoints.
// One POST per function; args match the p_* parameter names the frontend sends.
const router = Router()
router.use(requireAuth)

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN'])
function assertAdmin(req: AuthRequest) {
  if (!req.user || !ADMIN_ROLES.has(req.user.role)) {
    const err: any = new Error('Forbidden: admin only'); err.status = 403; throw err
  }
}

// Resolve a Prisma delegate for an operational table by its snake_case name.
// Pass the transaction client (tx) when inside $transaction so the work runs
// in that transaction rather than on the global connection.
function del(table: string, client: any = prisma): any {
  const cfg = getTableConfig(table)
  if (!cfg) { const e: any = new Error(`Unknown table ${table}`); e.status = 500; throw e }
  return client[cfg.delegate]
}

// email_for_username — resolve a login email from a username (used by the
// Supabase login flow; harmless to keep for parity).
router.post('/email_for_username', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.body.p_username }, select: { email: true },
    })
    res.json({ success: true, data: user?.email ?? null })
  } catch (err) { next(err) }
})

// admin_set_user_email — admin corrects a user's email.
router.post('/admin_set_user_email', async (req: AuthRequest, res, next) => {
  try {
    assertAdmin(req)
    const email = String(req.body.p_email ?? '').trim().toLowerCase()
    if (!email) { const e: any = new Error('Email is required'); e.status = 400; throw e }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { const e: any = new Error('Invalid email format'); e.status = 400; throw e }
    await prisma.user.update({ where: { id: req.body.p_user_id }, data: { email } })
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// admin_delete_user — admin removes an account (cannot delete self).
router.post('/admin_delete_user', async (req: AuthRequest, res, next) => {
  try {
    assertAdmin(req)
    if (req.body.p_user_id === req.user!.userId) {
      const e: any = new Error('Cannot delete your own account'); e.status = 400; throw e
    }
    await prisma.user.delete({ where: { id: req.body.p_user_id } })
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

// admin_reset_data — wipe operational data by scope. Mirrors the plpgsql
// version's delete order (FK-safe) and returns per-scope counts.
router.post('/admin_reset_data', async (req: AuthRequest, res, next) => {
  try {
    assertAdmin(req)
    const { p_expenses, p_trips, p_fuel, p_tires, p_stock, p_masters } = req.body
    const result = { expenses: 0, trips: 0, fuel: 0, tires: 0, stock: 0, masters: 0 }

    await prisma.$transaction(async (tx) => {
      const count = (t: string) => del(t, tx).count()
      const wipe = (t: string) => del(t, tx).deleteMany({})
      if (p_masters) {
        result.masters = (await count('employees')) + (await count('vehicles')) + (await count('customers'))
                       + (await count('partners')) + (await count('subcontractors')) + (await count('sub_drivers'))
        result.expenses = (await count('expense_headers')) + (await count('expenses'))
        result.trips = (await count('dispatch')) + (await count('fuel_rounds'))
        result.fuel = (await count('fuel_records')) + (await count('fuel_stock')) + (await count('fuel_transactions'))
        result.tires = await count('tires')
        result.stock = (await count('stock_items')) + (await count('stock_receipts'))
        for (const t of ['dispatch', 'maintenance', 'expense_headers', 'expenses', 'tires', 'fuel_records',
          'fuel_stock', 'fuel_rounds', 'fuel_transactions', 'stock_receipts', 'stock_items', 'fixed_costs',
          'sub_jobs', 'sub_drivers', 'vehicle_registrations', 'edit_approvals', 'request_approvals',
          'activity_logs', 'task_completions', 'customers', 'partners', 'subcontractors', 'employees', 'vehicles']) {
          await wipe(t)
        }
      } else {
        if (p_expenses) {
          result.expenses = (await count('expense_headers')) + (await count('expenses'))
          await wipe('expense_headers'); await wipe('expenses')
        }
        if (p_trips) {
          result.trips = (await count('dispatch')) + (await count('fuel_rounds'))
          await wipe('dispatch'); await wipe('fuel_rounds')
        }
        if (p_fuel) {
          result.fuel = (await count('fuel_records')) + (await count('fuel_stock')) + (await count('fuel_transactions'))
          await wipe('fuel_records'); await wipe('fuel_stock'); await wipe('fuel_transactions')
        }
        if (p_tires) {
          result.tires = await count('tires')
          await wipe('tires')
        }
        if (p_stock) {
          result.stock = (await count('stock_items')) + (await count('stock_receipts'))
          await wipe('stock_receipts'); await wipe('stock_items')
        }
      }

      const detail = Object.entries(result).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
      await tx.dataResetLog.create({
        data: { resetBy: req.user!.userId, details: detail, status: 'COMPLETED', completedAt: new Date() },
      })
    }, { timeout: 60000 })

    // Notify clients of the affected tables.
    for (const t of ['dispatch', 'expenses', 'fuel_records', 'tires', 'stock_items', 'vehicles', 'employees']) emitChange(t)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// complete_renewal — any authenticated user renews a vehicle's tax/permit/
// insurance/mileage/repair due-date and logs a task_completion. Reconstructed
// from the call site (the original SECURITY DEFINER body is not in the repo).
router.post('/complete_renewal', async (req: AuthRequest, res, next) => {
  try {
    const {
      p_vehicle_id, p_kind, p_next_date, p_next_mileage, p_next_maintenance, p_plate,
    } = req.body

    const vehiclePatch: Record<string, unknown> = {}
    if (p_kind === 'tax') vehiclePatch.tax = p_next_date || ''
    else if (p_kind === 'insurance') vehiclePatch.insurance = p_next_date || ''
    else if (p_kind === 'permit') vehiclePatch.dispatchPermit = p_next_date || ''
    else if (p_kind === 'mileage') {
      if (p_next_mileage != null) vehiclePatch.nextServiceKm = p_next_mileage
      if (p_next_maintenance) vehiclePatch.nextService = p_next_maintenance
    } else if (p_kind === 'repair') {
      if (p_next_maintenance) vehiclePatch.nextService = p_next_maintenance
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(vehiclePatch).length && p_vehicle_id) {
        await del('vehicles', tx).update({ where: { id: p_vehicle_id }, data: vehiclePatch })
      }
      await del('task_completions', tx).create({
        data: {
          alertKind: p_kind,
          vehicleId: p_vehicle_id || null,
          vehiclePlate: p_plate || '',
          userId: req.user!.userId,
          nextDate: p_next_date || '',
          nextMileage: p_next_mileage ?? null,
          nextMaintenanceDate: p_next_maintenance || '',
        },
      })
    })

    emitChange('vehicles'); emitChange('task_completions'); emitChange('maintenance')
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})

export default router
