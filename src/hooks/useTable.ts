import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAll, getOne, insertOne, updateOne, deleteOne } from '../lib/crud'

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

export function useInsert<T>(table: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: Partial<T>) => insertOne<T>(table, row),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: [table] }) },
  })
}

export function useUpdate<T>(table: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<T> }) => updateOne<T>(table, id, patch),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: [table] }) },
  })
}

export function useDelete(table: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOne(table, id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: [table] }) },
  })
}
