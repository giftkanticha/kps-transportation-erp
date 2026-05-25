import { useMemo } from 'react'
import { useList } from './useTable'
import type { Dispatch, DispatchLeg } from '../types'

// Dispatch legs live in the separate `dispatch_legs` table, but the rest of the
// app reads them as a nested `dispatch.legs` array (the shape from the old
// localStorage model). This adapter re-attaches them so existing calculations
// (db.legsOf, db.roundRevenue, etc.) keep working unchanged.
export function useDispatches() {
  const q = useList<Dispatch>('dispatch')
  const legsQ = useList<DispatchLeg>('dispatch_legs', 'sort_order', true)

  const data = useMemo<Dispatch[]>(() => {
    const byDispatch = new Map<string, DispatchLeg[]>()
    for (const l of legsQ.data ?? []) {
      if (!l.dispatchId) continue
      const arr = byDispatch.get(l.dispatchId) ?? []
      arr.push(l)
      byDispatch.set(l.dispatchId, arr)
    }
    return (q.data ?? []).map((d) => ({ ...d, legs: byDispatch.get(d.id) ?? d.legs ?? [] }))
  }, [q.data, legsQ.data])

  return { ...q, data }
}
