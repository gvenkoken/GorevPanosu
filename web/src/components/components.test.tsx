import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ActionButton } from './ActionButton'
import { FormField } from './FormField'
import { Notice } from './Notice'
import { StatusBadge } from './StatusBadge'

afterEach(cleanup)

it('shows every status as text', () => {
  render(<><StatusBadge status="open" /><StatusBadge status="completed" /><StatusBadge status="unassigned" /><StatusBadge status="inactive" /></>)
  for (const text of ['Açık', 'Tamamlandı', 'Atanmamış', 'Pasif']) expect(screen.getByText(text)).toBeTruthy()
})

it('disables a pending action and updates its label', () => {
  const onClick = vi.fn()
  const view = render(<ActionButton onClick={onClick}>Kaydet</ActionButton>)
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  expect(onClick).toHaveBeenCalledTimes(1)
  view.rerender(<ActionButton pending pendingLabel="Kaydediliyor…" onClick={onClick}>Kaydet</ActionButton>)
  const button = screen.getByRole('button', { name: 'Kaydediliyor…' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(button.getAttribute('aria-busy')).toBe('true')
  fireEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(1)
})

it('associates labels, hints and errors with the input', () => {
  render(<FormField label="Başlık" hint="Kısa bir ad" error="Başlık gerekli" />)
  const input = screen.getByRole('textbox', { name: 'Başlık' })
  expect(input.getAttribute('aria-invalid')).toBe('true')
  const descriptions = input.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent)
  expect(descriptions).toEqual(['Kısa bir ad', 'Başlık gerekli'])
})

it('announces warnings and informational notices', () => {
  render(<><Notice variant="warning">Atama yapılamadı</Notice><Notice>Kaydedildi</Notice></>)
  expect(screen.getByRole('alert').textContent).toBe('Atama yapılamadı')
  expect(screen.getByRole('status').textContent).toBe('Kaydedildi')
})
