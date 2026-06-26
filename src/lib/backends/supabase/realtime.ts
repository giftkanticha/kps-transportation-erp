import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../supabase'

// Subscribe to Postgres change events for a table and invalidate the matching
// React Query cache so the UI refetches. This is the Supabase implementation;
// the MySQL backend provides an identical hook signature over socket.io.
export function useRealtimeTable(table: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        qc.invalidateQueries({ queryKey: [table] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [table, qc])
}
