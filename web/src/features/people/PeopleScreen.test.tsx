import { MemoryRouter } from 'react-router-dom'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createAdminApi } from '../../api/admin'
import type { Person } from '../../api/admin'
import type { Fetch } from '../../api/client'
import { PeopleScreen } from './PeopleScreen'

afterEach(cleanup)
const active: Person = { id: 'active', fullName: 'Ayşe Yılmaz', isActive: true }
const inactive: Person = { id: 'inactive', fullName: 'Ali Kaya', isActive: false }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
function setup(options: { people?: Person[]; warning?: boolean; failSave?: boolean; failConfirm?: boolean; failList?: boolean } = {}) {
  let listCalls = 0
  const request = vi.fn<Fetch>(async (path, init) => {
    if (init?.method === 'GET') {
      listCalls++
      if (options.failList && listCalls === 1) throw new Error('Liste alınamadı.')
      return response(options.people ?? [active, inactive])
    }
    const body = JSON.parse(String(init?.body))
    if (String(path).endsWith('/deactivate')) {
      if (options.warning && !body.confirm) return response({ openTaskCount: 3 }, 409)
      if (options.failConfirm && body.confirm) throw new Error('Pasife alma başarısız.')
      return response({ ...active, isActive: false })
    }
    if (options.failSave) return response({ errors: { fullName: ['Bu ad kullanılamaz.'] } }, 400)
    return response({ id: init?.method === 'POST' ? 'new' : 'inactive', ...body })
  })
  render(<MemoryRouter><PeopleScreen api={createAdminApi(request)} /></MemoryRouter>)
  return request
}
function writes(request: ReturnType<typeof setup>) {
  return request.mock.calls.filter(([, init]) => init?.method !== 'GET')
}
function row(name: string) {
  return within(screen.getByText(name).closest('li')!)
}

it('lists active and inactive text states without deletion or reactivation', async () => {
  const request = setup()
  await screen.findByText(active.fullName)
  expect(row(active.fullName).getByText('Aktif')).toBeTruthy()
  expect(row(inactive.fullName).getByText('Pasif')).toBeTruthy()
  expect(row(inactive.fullName).queryByRole('button', { name: /pasife al/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /sil|aktif yap/i })).toBeNull()
  expect(writes(request)).toHaveLength(0)
})

it('creates a person and renames an inactive person while preserving the state', async () => {
  const request = setup()
  await screen.findByText(active.fullName)
  fireEvent.change(screen.getByLabelText('Ad soyad'), { target: { value: '  Deniz Ak  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ekle' }))
  await screen.findByText('Deniz Ak')
  expect(row('Deniz Ak').getByText('Aktif')).toBeTruthy()
  expect(writes(request)[0][0]).toBe('/api/admin/people')
  expect(writes(request)[0][1]?.method).toBe('POST')
  expect(JSON.parse(String(writes(request)[0][1]?.body))).toEqual({ fullName: 'Deniz Ak', isActive: true })
  fireEvent.click(screen.getByRole('button', { name: `${inactive.fullName} adını düzelt` }))
  expect((screen.getByLabelText('Ad soyad') as HTMLInputElement).value).toBe(inactive.fullName)
  fireEvent.change(screen.getByLabelText('Ad soyad'), { target: { value: 'Ali Demir' } })
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  await screen.findByText('Ali Demir')
  expect(row('Ali Demir').getByText('Pasif')).toBeTruthy()
  expect(writes(request)[1][0]).toBe('/api/admin/people/inactive')
  expect(writes(request)[1][1]?.method).toBe('PUT')
  expect(JSON.parse(String(writes(request)[1][1]?.body))).toEqual({ fullName: 'Ali Demir', isActive: false })
})

it('explains the 409 count and consequences and cancels without a confirmed request', async () => {
  const request = setup({ warning: true })
  const trigger = await screen.findByRole('button', { name: `${active.fullName} pasife al` })
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog.textContent).toContain('3 açık görev')
  expect(dialog.textContent).toContain('Atanmamış')
  expect(dialog.textContent).toContain('Tamamlanan görevlerde kişinin adı korunacaktır.')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(row(active.fullName).getByText('Aktif')).toBeTruthy()
  expect(writes(request)).toHaveLength(1)
  expect(JSON.parse(String(writes(request)[0][1]?.body))).toEqual({ confirm: false })
  expect(document.activeElement).toBe(trigger)
})

it('confirms deactivation, displays Pasif and links to tasks for reassignment', async () => {
  const request = setup({ warning: true })
  fireEvent.click(await screen.findByRole('button', { name: `${active.fullName} pasife al` }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Devam et' }))
  await screen.findByText(`${active.fullName} pasife alındı.`)
  expect(row(active.fullName).getByText('Pasif')).toBeTruthy()
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(writes(request)).toHaveLength(2)
  expect(writes(request)[1][0]).toBe('/api/admin/people/active/deactivate')
  expect(writes(request)[1][1]?.method).toBe('POST')
  expect(JSON.parse(String(writes(request)[1][1]?.body))).toEqual({ confirm: true })
  expect(screen.getByRole('link', { name: /Görevler ekranına dön/ }).getAttribute('href')).toBe('/tasks')
})

it('deactivates directly when the API does not require confirmation', async () => {
  const request = setup()
  fireEvent.click(await screen.findByRole('button', { name: `${active.fullName} pasife al` }))
  await screen.findByText(`${active.fullName} pasife alındı.`)
  expect(row(active.fullName).getByText('Pasif')).toBeTruthy()
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(writes(request)).toHaveLength(1)
})

it('preserves the active state and offers cancellation if confirmation fails', async () => {
  const request = setup({ warning: true, failConfirm: true })
  fireEvent.click(await screen.findByRole('button', { name: `${active.fullName} pasife al` }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Devam et' }))
  await screen.findByText('Pasife alma başarısız.')
  expect(row(active.fullName).getByText('Aktif')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
  expect(writes(request)).toHaveLength(2)
  expect(screen.queryByRole('alertdialog')).toBeNull()
})

it('validates blank names, allows edit cancellation and keeps input on server validation failure', async () => {
  const request = setup({ failSave: true })
  await screen.findByText(active.fullName)
  fireEvent.change(screen.getByLabelText('Ad soyad'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ekle' }))
  expect(screen.getByText('Ad soyad zorunludur.')).toBeTruthy()
  expect(writes(request)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: `${active.fullName} adını düzelt` }))
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(writes(request)).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Ad soyad'), { target: { value: 'Deniz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ekle' }))
  await screen.findByText('Bu ad kullanılamaz.')
  const input = screen.getByLabelText('Ad soyad') as HTMLInputElement
  expect(input.value).toBe('Deniz')
  expect(input.getAttribute('aria-invalid')).toBe('true')
})

it('shows list failures, retries and refreshes on demand', async () => {
  const request = setup({ failList: true, people: [] })
  await screen.findByText('Liste alınamadı.')
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
  await screen.findByText('Henüz kişi yok.')
  expect(request).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Yenile' }))
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
  await screen.findByText('Henüz kişi yok.')
})

it('shows loading and prevents duplicate writes while an injected request is pending', async () => {
  let finishList!: (value: Response) => void
  let finishWrite!: (value: Response) => void
  const request = vi.fn<Fetch>((_path, init) => new Promise(resolve => {
    if (init?.method === 'GET') finishList = resolve
    else finishWrite = resolve
  }))
  render(<MemoryRouter><PeopleScreen api={createAdminApi(request)} /></MemoryRouter>)
  expect(screen.getByText('Kişiler yükleniyor…')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Yenile' }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { finishList(response([active])) })
  fireEvent.click(screen.getByRole('button', { name: `${active.fullName} pasife al` }))
  expect((screen.getByRole('button', { name: `${active.fullName} pasife al` }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: `${active.fullName} pasife al` }))
  expect(writes(request)).toHaveLength(1)
  await act(async () => { finishWrite(response({ ...active, isActive: false })) })
  expect(row(active.fullName).getByText('Pasif')).toBeTruthy()
})
