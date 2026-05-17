import React from 'react'

interface InfoProps {
  label: string
  value: React.ReactNode
}

export function Info({ label, value }: InfoProps) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
      <div style={{ width: 140, color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5 }}>{value}</div>
    </div>
  )
}
