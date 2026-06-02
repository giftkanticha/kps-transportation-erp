import type { CSSProperties } from 'react'

// Shared styles for LoginScreen + RegisterPage so the two pages stay visually identical.

export const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'radial-gradient(ellipse at top, #F0FDF4 0%, #ECFDF5 55%, #DCFCE7 100%)',
  padding: '40px 20px',
  fontFamily: 'var(--font-sans)',
}

export const logoStyle: CSSProperties = {
  width: 76, height: 76, margin: '0 auto 18px',
  background: 'linear-gradient(135deg, #34D399, #059669)',
  borderRadius: 18,
  display: 'grid', placeItems: 'center',
  boxShadow: '0 10px 24px -8px rgba(16,185,129,.55)',
  color: '#fff',
}

export const cardStyle: CSSProperties = {
  marginTop: 28,
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 12px 36px -12px rgba(15,23,42,.12), 0 4px 10px -4px rgba(15,23,42,.06)',
  padding: 26,
  textAlign: 'left',
}

export const tabsContainerStyle: CSSProperties = {
  background: '#F1F5F9',
  borderRadius: 12,
  padding: 4,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
  marginBottom: 22,
}

export const activeTabStyle: CSSProperties = {
  padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#fff', color: '#0F172A', fontWeight: 600, fontSize: 13.5,
  boxShadow: '0 1px 2px rgba(15,23,42,.08)', fontFamily: 'inherit',
}

export const inactiveTabStyle: CSSProperties = {
  padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'transparent', color: '#64748B', fontWeight: 500, fontSize: 13.5,
  fontFamily: 'inherit',
}

export const labelStyle: CSSProperties = {
  fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6,
}

export const inputStyle: CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14,
  background: '#fff', color: '#0F172A', outline: 'none', fontFamily: 'inherit',
}

export const primaryBtnStyle: CSSProperties = {
  marginTop: 6, height: 46, borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg, #34D399, #10B981)',
  color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
  fontFamily: 'inherit', boxShadow: '0 6px 14px -4px rgba(16,185,129,.45)',
}

export const outlineBtnStyle: CSSProperties = {
  marginTop: 2, height: 44, borderRadius: 10,
  background: '#fff', color: '#475569', border: '1px solid #E2E8F0',
  fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

export const errorBoxStyle: CSSProperties = {
  background: '#FEE2E2', color: '#991B1B',
  padding: '9px 12px', borderRadius: 8, fontSize: 12.5,
}
