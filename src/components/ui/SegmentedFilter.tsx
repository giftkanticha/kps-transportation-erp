import type { CSSProperties } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedFilterProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentOption<T>[]
  style?: CSSProperties
}

export function SegmentedFilter<T extends string>({ value, onChange, options, style }: SegmentedFilterProps<T>) {
  return (
    <div style={{ background: '#F1F5F9', borderRadius: 'var(--r-md)', padding: 3, display: 'inline-flex', gap: 2, ...style }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              fontFamily: 'inherit',
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? '#fff' : 'var(--text-2)',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
