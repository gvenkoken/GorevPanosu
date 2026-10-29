import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createAdminApi } from '../../api/admin'
import type { Task } from '../../api/admin'
import type { Fetch } from '../../api/client'
import { TaskForm } from './TaskForm'

afterEach(cleanup)
const task: Task = {
  id: 'task-1', title: 'Mevcut görev', description: 'Açıklama metni',
  dueDate: '2026-11-10', assigneeId: 'active', status: 'Completed',
  createdAt: '2026-10-01T10:00:00Z', completedAt: '2026-10-02T10:00:00Z',
}
function setup(options: { edit?: boolean; fail?: boolean } = {}) {
  const request = vi.fn<Fetch>(async (path, init) => {
    if (String(path).endsWith('/people')) return new Response(JSON.stringify([
      { id: 'active', fullName: 'Aktif kişi', isActive: true },
      { id: 'inactive', fullName: 'Pasif kişi', isActive: false },
    ]))
    if (init?.method === 'GET') return new Response(JSON.stringify(task))
    if (options.fail) return new Response(JSON.stringify({ errors: {
      Title: ['Bu başlık kullanılamaz.'], Description: ['Açıklamayı kontrol edin.'],
      DueDate: ['Son tarih geçersiz.'], AssigneeId: ['Atama geçersiz.'],
    } }), { status: 400 })
    return new Response(JSON.stringify(task))
  })
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  render(<TaskForm api={createAdminApi(request)} taskId={options.edit ? task.id : undefined} onSaved={onSaved} onCancel={onCancel} />)
  return { request, onSaved, onCancel }
}
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value
const writes = (request: ReturnType<typeof setup>['request']) => request.mock.calls.filter(([, init]) => init?.method !== 'GET')

it.each([
  ['   ', 'Başlık zorunludur.'],
  ['a'.repeat(121), 'Başlık en fazla 120 karakter olabilir.'],
])('rejects invalid title %s without an API write', async (title, error) => {
  const { request } = setup()
  const input = await screen.findByLabelText('Başlık')
  fireEvent.change(input, { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  expect(screen.getByText(error)).toBeTruthy()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(writes(request)).toHaveLength(0)
})

it('offers only active people and the unassigned option', async () => {
  setup()
  const select = await screen.findByRole('combobox', { name: 'Atanan kişi' })
  expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['Atanmamış', 'Aktif kişi'])
})

it('keeps all entered values and associates server 400 errors with fields', async () => {
  const { onSaved } = setup({ fail: true })
  await screen.findByLabelText('Başlık')
  for (const [label, entered] of [['Başlık', 'Yeni görev'], ['Açıklama', 'Notlar'], ['Son tarih', '2026-12-01'], ['Atanan kişi', 'active']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: entered } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  await screen.findByText('Bu başlık kullanılamaz.')
  for (const [label, entered, error] of [
    ['Başlık', 'Yeni görev', 'Bu başlık kullanılamaz.'],
    ['Açıklama', 'Notlar', 'Açıklamayı kontrol edin.'],
    ['Son tarih', '2026-12-01', 'Son tarih geçersiz.'],
    ['Atanan kişi', 'active', 'Atama geçersiz.'],
  ]) {
    expect(value(label)).toBe(entered)
    const field = screen.getByLabelText(label)
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(field.getAttribute('aria-describedby')!.split(' ').at(-1)!)?.textContent).toBe(error)
  }
  expect(onSaved).not.toHaveBeenCalled()
})

it('loads edit values and saves only editable fields using PUT', async () => {
  const { request, onSaved } = setup({ edit: true })
  await screen.findByDisplayValue(task.title)
  expect(value('Açıklama')).toBe(task.description)
  expect(value('Son tarih')).toBe(task.dueDate)
  expect(value('Atanan kişi')).toBe('active')
  expect(screen.queryByLabelText(/Oluşturulma|Tamamlanma|Durum/)).toBeNull()
  fireEvent.change(screen.getByLabelText('Başlık'), { target: { value: 'Düzenlenmiş' } })
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(task))
  const [path, init] = writes(request)[0]
  expect(path).toBe('/api/admin/tasks/task-1')
  expect(init?.method).toBe('PUT')
  expect(JSON.parse(String(init?.body))).toEqual({ title: 'Düzenlenmiş', description: task.description, dueDate: task.dueDate, assigneeId: 'active' })
})

it('creates with POST, accepts 120 characters and cancels without saving', async () => {
  const { request, onSaved, onCancel } = setup()
  const title = await screen.findByLabelText('Başlık')
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(writes(request)).toHaveLength(0)
  fireEvent.change(title, { target: { value: 'a'.repeat(120) } })
  expect(screen.getByText('Kalan karakter: 0')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  const [path, init] = writes(request)[0]
  expect(path).toBe('/api/admin/tasks')
  expect(init?.method).toBe('POST')
  expect(JSON.parse(String(init?.body))).toEqual({ title: 'a'.repeat(120), description: null, dueDate: null, assigneeId: null })
})
