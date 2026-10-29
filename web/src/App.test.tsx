import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { createAdminApi } from './api/admin'
import type { Task } from './api/admin'
import type { Fetch } from './api/client'
import { App } from './App'

afterEach(cleanup)

const task: Task = {
  id: 'task-1', title: 'Mevcut görev', description: 'Görev açıklaması',
  dueDate: '2026-11-10', assigneeId: null, status: 'Open',
  createdAt: '2026-10-01T10:00:00Z', completedAt: null,
}

function setup(route = '/') {
  let tasks = [{ ...task }]
  const request = vi.fn<Fetch>(async (path, init) => {
    const url = String(path)
    if (url === '/api/admin/people') return new Response(JSON.stringify([
      { id: 'person-1', fullName: 'Ayşe Yılmaz', isActive: true },
      { id: 'person-2', fullName: 'Ali Kaya', isActive: false },
    ]))
    if (init?.method === 'POST' || init?.method === 'PUT') {
      const saved = { ...task, ...JSON.parse(String(init.body)) }
      tasks = [saved]
      return new Response(JSON.stringify(saved))
    }
    if (url === '/api/admin/tasks') return new Response(JSON.stringify(tasks))
    if (url === '/api/admin/tasks/task-1') return new Response(JSON.stringify(tasks[0]))
    throw new Error('Beklenmeyen API isteği: ' + url)
  })
  render(<MemoryRouter initialEntries={[route]}><App api={createAdminApi(request)} /></MemoryRouter>)
  return request
}

function expectCurrent(name: 'Görevler' | 'Kişiler') {
  for (const label of ['Görevler', 'Kişiler']) {
    expect(screen.getByRole('link', { name: label }).getAttribute('aria-current'))
      .toBe(label === name ? 'page' : null)
  }
}

it('opens the real task table at the root without placeholder text', async () => {
  setup()
  const table = await screen.findByRole('table')
  expect(screen.queryByText(/yakında burada olacak/)).toBeNull()
  for (const name of ['Başlık', 'Atanan kişi', 'Son tarih', 'Durum']) {
    expect(within(table).getByRole('columnheader', { name })).toBeTruthy()
  }
  const row = within(table).getByRole('row', { name: /Mevcut görev/ })
  expect(within(row).getByText('Atanmamış', { selector: '.badge' })).toBeTruthy()
  expect(within(row).getByText('Açık', { selector: '.badge' })).toBeTruthy()
  expectCurrent('Görevler')
})

it('opens PeopleScreen and updates the active sidebar link in both directions', async () => {
  setup('/tasks')
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('link', { name: 'Kişiler' }))
  expect(await screen.findByText('Ayşe Yılmaz')).toBeTruthy()
  expect(screen.getByRole('form', { name: 'Kişi ekle' })).toBeTruthy()
  expect(screen.getByText('Pasif', { selector: '.badge' })).toBeTruthy()
  expectCurrent('Kişiler')
  fireEvent.click(screen.getByRole('link', { name: 'Görevler' }))
  await screen.findByRole('table')
  expectCurrent('Görevler')
})

it('opens PeopleScreen directly', async () => {
  setup('/people')
  expect(await screen.findByText('Ayşe Yılmaz')).toBeTruthy()
  expectCurrent('Kişiler')
})

it.each([
  ['create', 'save'],
  ['create', 'cancel'],
  ['edit', 'save'],
  ['edit', 'cancel'],
])('navigates from the list to %s and returns after %s', async (mode, action) => {
  const request = setup()
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('link', { name: mode === 'create' ? 'Yeni görev' : 'Düzenle' }))
  expect(screen.getByRole('heading', { name: mode === 'create' ? 'Yeni görev' : 'Görevi düzenle' })).toBeTruthy()
  const title = await screen.findByRole('textbox', { name: 'Başlık' })
  expect((title as HTMLInputElement).value).toBe(mode === 'create' ? '' : task.title)
  expectCurrent('Görevler')
  if (action === 'save') {
    fireEvent.change(title, { target: { value: 'Kaydedilen görev' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  }
  const table = await screen.findByRole('table')
  expect(within(table).getByRole('rowheader', { name: action === 'save' ? 'Kaydedilen görev' : task.title })).toBeTruthy()
  expectCurrent('Görevler')
  const writes = request.mock.calls.filter(([, init]) => init?.method !== 'GET')
  if (action === 'cancel') expect(writes).toHaveLength(0)
  else {
    expect(writes).toHaveLength(1)
    expect(writes[0][0]).toBe(mode === 'create' ? '/api/admin/tasks' : '/api/admin/tasks/task-1')
    expect(writes[0][1]?.method).toBe(mode === 'create' ? 'POST' : 'PUT')
  }
})

it.each(['/tasks/new', '/tasks/task-1/edit'])('opens the form directly at %s', async route => {
  setup(route)
  const title = await screen.findByRole('textbox', { name: 'Başlık' })
  expect((title as HTMLInputElement).value).toBe(route.endsWith('/edit') ? task.title : '')
  expectCurrent('Görevler')
})
