import type { CSSProperties } from 'react'
import { Icon } from './Icon'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Fixed width for the wrapper. Defaults to flexible (flex: 1, minWidth: 240). */
  width?: number | string
  /** Extra styles merged onto the wrapper. */
  style?: CSSProperties
  autoFocus?: boolean
}

export function SearchInput({ value, onChange, placeholder = 'ค้นหา...', width, style, autoFocus }: SearchInputProps) {
  const wrapStyle: CSSProperties = width != null
    ? { position: 'relative', width }
    : { position: 'relative', flex: 1, minWidth: 240 }

  return (
    <div style={{ ...wrapStyle, ...style }}>
      <Icon
        name="search"
        size={15}
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}
      />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          height: 38,
          padding: '0 12px 0 36px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg)',
          fontSize: 13,
          color: 'var(--text)',
        }}
      />
    </div>
  )
}
