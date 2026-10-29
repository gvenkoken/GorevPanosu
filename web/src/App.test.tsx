import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

it('marks the tasks link as current by default', () => {
  render(<App />)
  expect(screen.getByRole('link', { name: 'Görevler' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('link', { name: 'Kişiler' }).hasAttribute('aria-current')).toBe(false)
  expect(screen.getByRole('heading', { name: 'Görevler' })).toBeTruthy()
})

it('routes to people and responds to navigation history changes', () => {
  window.history.replaceState(null, '', '/#/people')
  render(<App />)
  expect(screen.getByRole('link', { name: 'Kişiler' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('link', { name: 'Görevler' }).hasAttribute('aria-current')).toBe(false)
  expect(screen.getByRole('heading', { name: 'Kişiler' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Görevler' }).getAttribute('href')).toBe('#/tasks')
  act(() => {
    window.history.replaceState(null, '', '/#/tasks')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  expect(screen.getByRole('link', { name: 'Görevler' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('heading', { name: 'Görevler' })).toBeTruthy()
})
