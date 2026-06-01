export function usePrint() {
  const print = (orientation: 'portrait' | 'landscape' = 'portrait') => {
    // Orientation is driven by a CSS named page declared statically in
    // print.css (@page landscape). We only toggle a class on <body> — a
    // normal style change the print engine reliably picks up. (Injecting a
    // fresh @page { size } right before window.print() is NOT honored by
    // Chromium, which is why landscape reports printed portrait.)
    const cls = 'print-landscape'
    document.body.classList.toggle(cls, orientation === 'landscape')
    window.addEventListener(
      'afterprint',
      () => document.body.classList.remove(cls),
      { once: true },
    )
    window.print()
  }

  return { print }
}
