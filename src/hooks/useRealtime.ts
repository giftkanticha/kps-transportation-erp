import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

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
