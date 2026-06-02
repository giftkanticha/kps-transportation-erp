export function usePrint() {
  // Reports are always portrait now — wide tables (e.g. expense pivot) have
  // dedicated print-only portrait layouts in their components. Forcing
  // landscape via @page or CSS rotate proved unreliable across browsers.
  const print = (_orientation?: 'portrait' | 'landscape') => {
    void _orientation
    window.print()
  }

  return { print }
}
