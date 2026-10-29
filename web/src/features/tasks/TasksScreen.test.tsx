import { MemoryRouter } from 'react-router-dom'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createAdminApi } from '../../api/admin'
import type { Task } from '../../api/admin'
import { TasksScreen } from './TasksScreen'

const task: Task = {
  id: 't1', title: 'Rapor hazırla', description: null, dueDate: '2026-01-01',
  assigneeId: null, status: 'Open', createdAt: '2026-01-01T00:00:00Z', completedAt: null,
}
const now = () => new Date('2026-06-15T12:00:00Z')
function fixture(items: Task[] = [task]) {
  const api = createAdminApi(vi.fn())
  api.tasks.list = vi.fn().mockResolvedValue(items)
  api.people.list = vi.fn().mockResolvedValue([
    { id: 'p1', fullName: 'Ada', isActive: true },
    { id: 'p2', fullName: 'Ece', isActive: true },
    { id: 'p3', fullName: 'Pasif kişi', isActive: false },
  ])
  api.tasks.assign = vi.fn().mockImplementation(async (_id: string, assigneeId: string | null) => ({ ...task, assigneeId }))
  api.tasks.complete = vi.fn().mockResolvedValue({ ...task, status: 'Completed', completedAt: '2026-06-15T12:00:00Z' })
  api.tasks.reopen = vi.fn().mockResolvedValue(task)
  api.tasks.remove = vi.fn().mockResolvedValue(undefined)
  return api
}
afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows the columns, assignee, overdue label and form links', async () => {
  render(<MemoryRouter><TasksScreen api={fixture([task, { ...task, id: 't2', title: 'İkinci görev', assigneeId: 'p1', status: 'Completed' }])} now={now} /></MemoryRouter>)
  await screen.findByRole('table')
  for (const name of ['Başlık', 'Atanan kişi', 'Son tarih', 'Durum']) {
    expect(screen.getByRole('columnheader', { name })).toBeTruthy()
  }
  const row = screen.getByRole('row', { name: /Rapor hazırla/ })
  expect(within(row).getByText('Atanmamış', { selector: 'span' })).toBeTruthy()
  expect(within(row).getByText('01.01.2026')).toBeTruthy()
  expect(within(row).getByText('Gecikmiş')).toBeTruthy()
  expect(within(row).getByText('Açık')).toBeTruthy()
  expect(screen.getByText('Ada', { selector: 'span' })).toBeTruthy()
  expect(screen.getAllByText('Gecikmiş')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Yeni görev' }).getAttribute('href')).toBe('/tasks/new')
  expect(within(row).getByRole('link', { name: 'Düzenle' }).getAttribute('href')).toBe('/tasks/t1/edit')
  expect(screen.getByText(/Son yenileme:/).querySelector('time')?.dateTime).toBe(now().toISOString())
})

it('shows loading until the injected request resolves, then an empty state', async () => {
  const api = fixture()
  let resolve!: (items: Task[]) => void
  api.tasks.list = vi.fn(() => new Promise<Task[]>(done => { resolve = done }))
  render(<MemoryRouter><TasksScreen api={api} now={now} /></MemoryRouter>)
  expect(screen.getByText('Görevler yükleniyor…')).toBeTruthy()
  expect(screen.queryByRole('table')).toBeNull()
  await act(async () => { resolve([]) })
  expect(screen.getByText('Henüz görev yok.')).toBeTruthy()
})

it('retries a failed request through the injected API', async () => {
  const api = fixture()
  vi.mocked(api.tasks.list).mockRejectedValueOnce(new Error('Liste alınamadı'))
  render(<MemoryRouter><TasksScreen api={api} now={now} /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
  await screen.findByRole('table')
  expect(api.tasks.list).toHaveBeenCalledTimes(2)
  expect(api.people.list).toHaveBeenCalledTimes(2)
})

it('does not poll during 60 seconds and refreshes only when requested', async () => {
  vi.useFakeTimers()
  const api = fixture()
  render(<MemoryRouter><TasksScreen api={api} now={now} /></MemoryRouter>)
  await act(async () => {})
  await act(async () => { vi.advanceTimersByTime(60_000) })
  expect(api.tasks.list).toHaveBeenCalledTimes(1)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yenile' })) })
  expect(api.tasks.list).toHaveBeenCalledTimes(2)
  expect(api.people.list).toHaveBeenCalledTimes(2)
})

it('assigns, reassigns, unassigns, completes and reopens using the row actions', async () => {
  const api = fixture()
  render(<MemoryRouter><TasksScreen api={api} now={now} /></MemoryRouter>)
  const select = await screen.findByRole('combobox', { name: 'Rapor hazırla için atama' })
  expect(within(select).queryByRole('option', { name: 'Pasif kişi' })).toBeNull()
  for (const id of ['p1', 'p2', '']) {
    await act(async () => { fireEvent.change(select, { target: { value: id } }) })
    expect(api.tasks.assign).toHaveBeenLastCalledWith('t1', id || null)
    expect((select as HTMLSelectElement).value).toBe(id)
  }
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tamamla' })) })
  expect(api.tasks.complete).toHaveBeenCalledWith('t1')
  expect(screen.getByText('Tamamlandı')).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yeniden aç' })) })
  expect(api.tasks.reopen).toHaveBeenCalledWith('t1')
  expect(screen.getByText('Açık')).toBeTruthy()
})

it.each([
  { initialAssigneeId: null, value: 'p1', assigneeId: 'p1', label: 'Ada' },
  { initialAssigneeId: 'p1', value: '', assigneeId: null, label: 'Atanmamış' },
])('saves row assignment as $label through PUT without an alert', async ({ initialAssigneeId, value, assigneeId, label }) => {
  const request = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
    if (path === '/api/admin/tasks' && init?.method === 'GET') {
      return new Response(JSON.stringify([{ ...task, assigneeId: initialAssigneeId }]))
    }
    if (path === '/api/admin/people' && init?.method === 'GET') {
      return new Response(JSON.stringify([{ id: 'p1', fullName: 'Ada', isActive: true }]))
    }
    if (path === '/api/admin/tasks/t1/assign') {
      if (init?.method !== 'PUT') {
        return new Response(JSON.stringify({ title: 'Method Not Allowed' }), { status: 405 })
      }
      const body = JSON.parse(init.body as string) as { assigneeId: string | null }
      return new Response(JSON.stringify({ ...task, assigneeId: body.assigneeId }))
    }
    throw new Error(`Unexpected request: ${init?.method} ${path}`)
  })
  render(<MemoryRouter><TasksScreen api={createAdminApi(request)} now={now} /></MemoryRouter>)
  const select = await screen.findByRole('combobox', { name: 'Rapor hazırla için atama' })
  await act(async () => { fireEvent.change(select, { target: { value } }) })

  const assignments = request.mock.calls.filter(([path]) => path === '/api/admin/tasks/t1/assign')
  expect(assignments).toHaveLength(1)
  expect(assignments[0][1]?.method).toBe('PUT')
  expect(JSON.parse(assignments[0][1]?.body as string)).toEqual({ assigneeId })
  expect((select as HTMLSelectElement).value).toBe(value)
  const row = screen.getByRole('row', { name: /Rapor hazırla/ })
  expect(within(row).getByText(label, { selector: 'span' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Method Not Allowed')).toBeNull()
})

it('deletes only after inline confirmation, and restores focus on cancellation', async () => {
  const api = fixture()
  render(<MemoryRouter><TasksScreen api={api} now={now} /></MemoryRouter>)
  const trigger = await screen.findByRole('button', { name: 'Sil' })
  fireEvent.click(trigger)
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  expect(api.tasks.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(api.tasks.remove).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(trigger)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Silmeyi onayla' })) })
  expect(api.tasks.remove).toHaveBeenCalledExactlyOnceWith('t1')
  expect(screen.getByText('Henüz görev yok.')).toBeTruthy()
})

it('keeps the row and confirmation available when deletion fails', async () => {
  const api = fixture()
  vi.mocked(api.tasks.remove).mockRejectedValueOnce(new Error('Silinemedi'))
  render(<MemoryRouter><TasksScreen api={api} now={now} /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Sil' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Silmeyi onayla' })) })
  expect(screen.getByRole('alert').textContent).toBe('Silinemedi')
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  expect(screen.getByRole('row', { name: /Rapor hazırla/ })).toBeTruthy()
})
