import { useFontScale } from '../../hooks/useFontScale'

interface FontScaleControlProps {
  className?: string
}

// A−/A+ stepper that adjusts the printable report font size (screen + print).
// Marked `no-print` so the control itself never appears on the printout.
export function FontScaleControl({ className = '' }: FontScaleControlProps) {
  const { scale, inc, dec, reset, min, max } = useFontScale()
  const pct = Math.round(scale * 100)

  const btn: React.CSSProperties = {
    width: 30,
    height: 30,
    display: 'grid',
    placeItems: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--text-2)',
  }

  return (
    <div
      className={`no-print ${className}`.trim()}
      title="ปรับขนาดตัวหนังสือในรายงาน (มีผลทั้งบนจอและตอนพิมพ์)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md, 8px)',
        background: '#fff',
        height: 34,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={dec}
        disabled={scale <= min}
        style={{ ...btn, fontSize: 12, opacity: scale <= min ? 0.4 : 1 }}
        aria-label="ลดขนาดตัวหนังสือ"
      >
        A
      </button>
      <button
        type="button"
        onClick={reset}
        title="รีเซ็ตขนาด"
        style={{
          minWidth: 46,
          height: 34,
          border: 'none',
          borderLeft: '1px solid var(--line)',
          borderRight: '1px solid var(--line)',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-2)',
        }}
        aria-label="รีเซ็ตขนาดตัวหนังสือ"
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={inc}
        disabled={scale >= max}
        style={{ ...btn, fontSize: 17, fontWeight: 700, opacity: scale >= max ? 0.4 : 1 }}
        aria-label="เพิ่มขนาดตัวหนังสือ"
      >
        A
      </button>
    </div>
  )
}
