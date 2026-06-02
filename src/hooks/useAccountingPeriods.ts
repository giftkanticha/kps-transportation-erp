import { useMemo } from 'react'
import { useList } from './useTable'
import type {
  AccountingPeriod,
  AccountingPeriodSnapshot,
  Dispatch,
} from '../types'

export function useAccountingPeriods() {
  return useList<AccountingPeriod>('accounting_periods', 'year', false)
}

export function useAccountingPeriodSnapshots() {
  return useList<AccountingPeriodSnapshot>('accounting_period_snapshots', 'created_at', false)
}

/**
 * Look up the period for a given year/month.
 * Returns undefined if not created yet (means it's still OPEN by default).
 */
export function findPeriod(
  periods: AccountingPeriod[],
  year: number,
  month: number,
): AccountingPeriod | undefined {
  return periods.find(p => p.year === year && p.month === month)
}

/**
 * A period is "locked" only when status === CLOSED. PENDING_CLOSE still
 * allows edits — it's just a flag that the close workflow is in progress.
 */
export function isPeriodLocked(period: AccountingPeriod | undefined): boolean {
  return period?.status === 'CLOSED'
}

/**
 * Decide which period a dispatch belongs to. Priority:
 *   1. d.accountingPeriodId (explicit assignment, e.g. carried forward)
 *   2. depart || date — derived month/year
 */
export function periodForDispatch(
  d: Dispatch,
  periods: AccountingPeriod[],
): AccountingPeriod | undefined {
  if (d.accountingPeriodId) {
    return periods.find(p => p.id === d.accountingPeriodId)
  }
  const basis = d.depart || d.date
  if (!basis) return undefined
  const dt = new Date(basis)
  if (isNaN(dt.getTime())) return undefined
  return findPeriod(periods, dt.getFullYear(), dt.getMonth() + 1)
}

/**
 * Hook variant: returns rounds that belong to a given period, accounting for
 * carry-forward (a round can be re-assigned to a different period).
 */
export function useRoundsInPeriod(
  dispatches: Dispatch[],
  periods: AccountingPeriod[],
  periodId: string | undefined,
): Dispatch[] {
  return useMemo(() => {
    if (!periodId) return []
    const period = periods.find(p => p.id === periodId)
    if (!period) return []
    return dispatches.filter(d => {
      const p = periodForDispatch(d, periods)
      return p?.id === periodId
    })
  }, [dispatches, periods, periodId])
}

/**
 * Rounds that need a decision before a period can close:
 * - depart falls in the period
 * - round is still DRAFT (not yet closed by the driver/operator)
 */
export function pendingDecisionRounds(
  dispatches: Dispatch[],
  period: AccountingPeriod,
): Dispatch[] {
  return dispatches.filter(d => {
    // ถ้ารอบนี้ถูก carry-forward ไป period อื่นแล้ว → ไม่นับเข้า period นี้
    if (d.accountingPeriodId && d.accountingPeriodId !== period.id) return false
    const basis = (d.depart || d.date || '').slice(0, 10)
    if (!basis) return false
    const dt = new Date(basis)
    if (isNaN(dt.getTime())) return false
    if (dt.getFullYear() !== period.year || dt.getMonth() + 1 !== period.month) return false
    return d.roundStatus === 'draft'
  })
}

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export function formatPeriodLabel(p: Pick<AccountingPeriod, 'year' | 'month'>): string {
  return `${THAI_MONTH_NAMES[p.month - 1]} พ.ศ. ${p.year + 543}`
}
