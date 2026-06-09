import { useEffect, useState } from 'react'

// Shared font-scale preference for printable report tables.
// The chosen scale is written to the `--report-font-scale` CSS variable on
// <html> (consumed by `.print-area .tbl` rules in index.css/print.css, for both
// screen and print) and persisted to localStorage so it carries across pages.
const STORAGE_KEY = 'kps_report_font_scale'
const MIN = 0.8
const MAX = 1.6
const STEP = 0.1

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n * 10) / 10))

function readInitial(): number {
  if (typeof window === 'undefined') return 1
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const n = raw ? parseFloat(raw) : NaN
  return isNaN(n) ? 1 : clamp(n)
}

export function useFontScale() {
  const [scale, setScaleState] = useState<number>(readInitial)

  useEffect(() => {
    document.documentElement.style.setProperty('--report-font-scale', String(scale))
    try {
      window.localStorage.setItem(STORAGE_KEY, String(scale))
    } catch {
      /* ignore storage failures (private mode etc.) */
    }
  }, [scale])

  const setScale = (n: number) => setScaleState(clamp(n))
  const inc = () => setScaleState((s) => clamp(s + STEP))
  const dec = () => setScaleState((s) => clamp(s - STEP))
  const reset = () => setScaleState(1)

  return { scale, setScale, inc, dec, reset, min: MIN, max: MAX }
}
