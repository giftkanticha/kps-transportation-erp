import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { API_URL, tokenStore } from './api'

// Single shared socket connection for the whole app. socket.io-client is loaded
// lazily so a Supabase build never pulls it into the main bundle.
let socketPromise: Promise<Socket> | null = null

async function getSocket(): Promise<Socket> {
  if (!socketPromise) {
    socketPromise = import('socket.io-client').then(({ io }) => {
      const socket = io(API_URL || '/', {
        auth: { token: tokenStore.access },
        transports: ['websocket', 'polling'],
      })
      return socket
    })
  }
  return socketPromise
}

// Drop and recreate the socket — call on login/logout so the new JWT is used.
export async function resetSocket() {
  if (socketPromise) {
    const s = await socketPromise.catch(() => null)
    s?.disconnect()
    socketPromise = null
  }
}

// Mirror of the Supabase useRealtimeTable: on any change to `table`, invalidate
// the matching React Query cache so the UI refetches. Identical public
// signature, so call sites and pages don't change.
export function useRealtimeTable(table: string) {
  const qc = useQueryClient()
  useEffect(() => {
    let active = true
    let cleanup = () => {}
    void getSocket().then((socket) => {
      if (!active) return
      const handler = (payload: { table: string }) => {
        if (payload?.table === table) qc.invalidateQueries({ queryKey: [table] })
      }
      const onReconnect = () => qc.invalidateQueries({ queryKey: [table] })
      socket.on('table:changed', handler)
      socket.io.on('reconnect', onReconnect)
      cleanup = () => {
        socket.off('table:changed', handler)
        socket.io.off('reconnect', onReconnect)
      }
    })
    return () => { active = false; cleanup() }
  }, [table, qc])
}
