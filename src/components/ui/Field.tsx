import React from 'react'

interface FieldProps {
  label: string
  children: React.ReactNode
  full?: boolean
}

export function Field({ label, children, full }: FieldProps) {
  return (
    <div className="field" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label>{label}</label>
      {children}
    </div>
  )
}
