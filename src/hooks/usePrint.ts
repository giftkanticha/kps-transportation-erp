const STYLE_ID = '__kps_print_page__'

export function usePrint() {
  const print = (orientation: 'portrait' | 'landscape' = 'portrait') => {
    // Remove any previous override
    document.getElementById(STYLE_ID)?.remove()

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `@page { size: A4 ${orientation}; margin: 12mm; }`
    document.head.appendChild(style)

    window.print()

    window.addEventListener('afterprint', () => {
      document.getElementById(STYLE_ID)?.remove()
    }, { once: true })
  }

  return { print }
}
