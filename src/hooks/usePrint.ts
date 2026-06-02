export function usePrint() {
  // Landscape opt-in via `body.print-landscape` → `@page kps-land` (see print.css).
  // The print() call is deferred to the next tick so the click handler returns
  // immediately — keeps INP fast (window.print blocks the main thread while the
  // browser builds the print preview).
  const print = (orientation: 'portrait' | 'landscape' = 'portrait') => {
    const cls = 'print-landscape'
    const isLandscape = orientation === 'landscape'
    document.documentElement.classList.toggle(cls, isLandscape)
    document.body.classList.toggle(cls, isLandscape)
    window.addEventListener(
      'afterprint',
      () => {
        document.documentElement.classList.remove(cls)
        document.body.classList.remove(cls)
      },
      { once: true },
    )
    setTimeout(() => window.print(), 0)
  }

  return { print }
}
