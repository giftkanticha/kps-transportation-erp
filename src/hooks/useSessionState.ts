import { useEffect, useState } from 'react'

// A drop-in replacement for useState that persists the value in sessionStorage.
// Useful for report filters so they survive in-app navigation (e.g. leaving a
// report to edit/close a round and coming back) instead of resetting on every
// remount. Values are scoped to the browser tab/session and clear when it ends.
function resolve<T>(initial: T | (() => T)): T {
  return typeof initial === 'function' ? (initial as () => T)() : initial
}

export function useSessionState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return resolve(initial)
    try {
      const raw = window.sessionStorage.getItem(key)
      if (raw != null) return JSON.parse(raw) as T
    } catch {
      /* ignore malformed/unavailable storage */
    }
    return resolve(initial)
  })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore storage failures (private mode etc.) */
    }
  }, [key, value])

  return [value, setValue] as const
}
