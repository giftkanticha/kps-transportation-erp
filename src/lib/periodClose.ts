import { supabase } from './supabase'
import { db } from './db'
import { camelToSnake } from './caseTransform'
import type {
  AccountingPeriod,
  AccountingPeriodSnapshotData,
  Dispatch,
  FuelRound,
  Vehicle,
} from '../types'

interface VehicleSnapshotInput {
  vehicleId: string | null
  plate: string
  data: AccountingPeriodSnapshotData
}

/**
 * Aggregate per-vehicle P&L for a set of rounds. Used both to display the
 * pre-close preview and to persist snapshots on actual close.
 */
export function computeVehicleSnapshots(
  rounds: Dispatch[],
  vehicles: Vehicle[],
  fuelRounds: FuelRound[],
): VehicleSnapshotInput[] {
  const groups = new Map<string, { plate: string; rounds: Dispatch[] }>()
  rounds.forEach(r => {
    const key = r.vehicleId ?? ''
    if (!groups.has(key)) {
      const v = vehicles.find(x => x.id === r.vehicleId)
      groups.set(key, { plate: v?.plate ?? '—', rounds: [] })
    }
    groups.get(key)!.rounds.push(r)
  })

  return Array.from(groups.entries()).map(([vehicleId, g]) => {
    let revenue = 0, fuelCost = 0, perDiem = 0, other = 0, distance = 0, liters = 0, legs = 0
    g.rounds.forEach(r => {
      const fr = db.fuelRoundOfDispatch(r.id, fuelRounds)
      const consumed = fr ? db.fuelRoundConsumed(fr) : (r.liters || 0)
      revenue  += db.roundRevenue(r)
      perDiem  += db.roundPerDiem(r)
      other    += db.roundOtherExpenses(r)
      fuelCost += fr ? db.fuelRoundCost(fr) : (r.cost || 0)
      distance += db.roundDistance(r)
      liters   += consumed
      legs     += (r.legs ?? []).length
    })
    const profit = revenue - fuelCost - perDiem - other
    const avgKmPerL = liters > 0 && distance > 0 ? distance / liters : null
    return {
      vehicleId: vehicleId || null,
      plate: g.plate,
      data: {
        rounds: g.rounds.length,
        legs,
        distance,
        liters,
        revenue,
        fuelCost,
        perDiem,
        other,
        profit,
        avgKmPerL,
      },
    }
  }).sort((a, b) => a.plate.localeCompare(b.plate))
}

/**
 * Atomically: insert snapshots → mark period CLOSED → lock all dispatch rows
 * that fall under this period. Done in 3 statements; Postgres will rollback
 * each in isolation but for our scale that's acceptable. Future hardening:
 * wrap in a SQL function (transaction).
 */
export async function closePeriod(args: {
  period: AccountingPeriod
  rounds: Dispatch[]
  vehicles: Vehicle[]
  fuelRounds: FuelRound[]
  closedById: string | null
  closedByName: string | null
}): Promise<void> {
  const { period, rounds, vehicles, fuelRounds, closedById, closedByName } = args

  const snapshots = computeVehicleSnapshots(rounds, vehicles, fuelRounds)

  // 1. snapshots — upsert by (period_id, vehicle_id)
  if (snapshots.length > 0) {
    const rows = snapshots.map(s => ({
      period_id:  period.id,
      vehicle_id: s.vehicleId,
      plate:      s.plate,
      data:       s.data,
    }))
    const { error } = await supabase
      .from('accounting_period_snapshots')
      .upsert(rows, { onConflict: 'period_id,vehicle_id' })
    if (error) throw new Error(`snapshot save failed: ${error.message}`)
  }

  // 2. mark period CLOSED
  {
    const { error } = await supabase
      .from('accounting_periods')
      .update(camelToSnake<Record<string, unknown>>({
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        closedBy: closedById,
        closedByName: closedByName ?? '',
      }))
      .eq('id', period.id)
    if (error) throw new Error(`close period failed: ${error.message}`)
  }

  // 3. lock dispatches in this period
  const ids = rounds.map(r => r.id)
  if (ids.length > 0) {
    const { error } = await supabase
      .from('dispatch')
      .update({ locked: true })
      .in('id', ids)
    if (error) throw new Error(`lock dispatches failed: ${error.message}`)
  }
}

/**
 * Carry a round forward to the next month's (open) period. Sets:
 *   - dispatch.accounting_period_id = nextPeriod.id
 *   - dispatch.carry_forward_from   = currentPeriod.id
 * Leaves depart/date untouched so the operational history is preserved.
 */
export async function carryForwardRound(
  roundId: string,
  fromPeriodId: string,
  toPeriodId: string,
): Promise<void> {
  const { error } = await supabase
    .from('dispatch')
    .update(camelToSnake<Record<string, unknown>>({
      accountingPeriodId: toPeriodId,
      carryForwardFrom:   fromPeriodId,
    }))
    .eq('id', roundId)
  if (error) throw new Error(`carry forward failed: ${error.message}`)
}

/**
 * Reopen a closed period — admin only.
 *   - status → OPEN
 *   - clear locked on all dispatches in the period
 * Snapshots are kept (read-only history). A fresh close will overwrite them.
 */
export async function reopenPeriod(
  periodId: string,
  reopenedById: string | null,
  reason: string,
): Promise<void> {
  {
    const { error } = await supabase
      .from('accounting_periods')
      .update(camelToSnake<Record<string, unknown>>({
        status: 'OPEN',
        reopenedAt: new Date().toISOString(),
        reopenedBy: reopenedById,
        reopenReason: reason,
      }))
      .eq('id', periodId)
    if (error) throw new Error(`reopen period failed: ${error.message}`)
  }
  {
    const { error } = await supabase
      .from('dispatch')
      .update({ locked: false })
      .eq('accounting_period_id', periodId)
    if (error) throw new Error(`unlock dispatches failed: ${error.message}`)
  }
}
