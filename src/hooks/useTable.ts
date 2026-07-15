import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAll, getOne, insertOne, updateOne, deleteOne } from '../lib/crud'
import { logActivity } from '../lib/activityLog'
import { useAuth } from '../context/AuthContext'

export function useList<T>(table: string, orderBy = 'created_at', ascending = false) {
  return useQuery({
    queryKey: [table, 'list', orderBy, ascending],
    queryFn:  () => listAll<T>(table, orderBy, ascending),
  })
}

export function useOne<T>(table: string, id: string | null | undefined) {
  return useQuery({
    queryKey: [table, 'one', id],
    queryFn:  () => getOne<T>(table, id as string),
    enabled:  !!id,
  })
}

interface MutationOpts<T> {
  /** When provided, logged to activity_logs on success as { who: current user, type: table, text: activity(result) } */
  activity?: (result: T) => string
}

export function useInsert<T>(table: string, opts?: MutationOpts<T>) {
  const qc = useQueryClient()
  const { legacyUser } = useAuth()
  return useMutation({
    mutationFn: (row: Partial<T>) => insertOne<T>(table, row),
    onSuccess:  (result) => {
      qc.invalidateQueries({ queryKey: [table] })
      if (opts?.activity) logActivity(legacyUser?.name ?? 'ไม่ทราบผู้ใช้', table, opts.activity(result))
    },
  })
}

export function useUpdate<T>(table: string, opts?: MutationOpts<T>) {
  const qc = useQueryClient()
  const { legacyUser } = useAuth()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<T> }) => updateOne<T>(table, id, patch),
    onSuccess:  (result) => {
      qc.invalidateQueries({ queryKey: [table] })
      if (opts?.activity) logActivity(legacyUser?.name ?? 'ไม่ทราบผู้ใช้', table, opts.activity(result))
    },
  })
}

export function useDelete(table: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOne(table, id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: [table] }) },
  })
}
