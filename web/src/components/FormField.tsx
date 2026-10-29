import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }
export function FormField({ label, error, hint, id, ...props }: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptions = [props['aria-describedby'], hint ? inputId + '-hint' : '', error ? inputId + '-error' : ''].filter(Boolean).join(' ')
  return <div className="form-field">
    <label htmlFor={inputId}>{label}</label>
    <input {...props} id={inputId} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={descriptions || undefined} />
    {hint && <p id={inputId + '-hint'} className="muted">{hint}</p>}
    {error && <p id={inputId + '-error'} className="field-error">{error}</p>}
  </div>
}
