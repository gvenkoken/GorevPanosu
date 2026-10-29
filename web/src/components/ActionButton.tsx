import type { ButtonHTMLAttributes } from 'react'
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'plain' | 'danger'
  pending?: boolean
  pendingLabel?: string
}
export function ActionButton({ variant = 'primary', pending = false, pendingLabel = 'İşleniyor…', disabled, children, className = '', type = 'button', ...props }: Props) {
  return <button {...props} type={type} className={`button button--${variant} ${className}`} disabled={disabled || pending} aria-busy={pending}>{pending ? pendingLabel : children}</button>
}
