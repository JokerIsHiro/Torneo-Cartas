import type { CSSProperties } from 'react'


export const cardStyle: CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid black',
  borderRadius: '15px',
  padding: '1rem 1.25rem',
  marginBottom: '.75rem',
}

export const cardTitleStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '.75rem',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
}

export const btnStyle: CSSProperties = {
  padding: '8px 14px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap' as const,
}