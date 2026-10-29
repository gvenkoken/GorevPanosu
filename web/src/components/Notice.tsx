import type { ReactNode } from 'react'
export function Notice({ children, variant = 'info' }: { children: ReactNode; variant?: 'info' | 'success' | 'warning' | 'error' }) {
  return <div className={`notice notice--${variant}`} role={variant === 'warning' || variant === 'error' ? 'alert' : 'status'}>{children}</div>
}
