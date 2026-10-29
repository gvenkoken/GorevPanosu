import { expect, it, vi } from 'vitest'
import { api, ApiError } from './client'
import { createAdminApi } from './admin'

it('calls typed admin read endpoints', async () => {
  const people = [{ id: 'p1', fullName: 'Ada', isActive: true }]
  const request = vi.fn(async () => new Response(JSON.stringify(people)))
  const admin = createAdminApi(request)
  expect(await admin.people.list()).toEqual(people)
  await admin.people.get('p/1')
  await admin.tasks.list()
  await admin.tasks.get('t1')
  expect(request.mock.calls.map(call => (call as unknown[])[0])).toEqual([
    '/api/admin/people', '/api/admin/people/p%2F1', '/api/admin/tasks', '/api/admin/tasks/t1',
  ])
})

it('serializes create and update requests for both resources', async () => {
  const request = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
  const admin = createAdminApi(request)
  const person = { fullName: 'Ada', isActive: false }
  const task = { title: 'Rapor', description: null, dueDate: '2026-11-01', assigneeId: 'p1' }
  await admin.people.create(person)
  await admin.people.update('p1', person)
  await admin.tasks.create(task)
  await admin.tasks.update('t1', task)
  expect(request.mock.calls.map(([path, init]) => [path, init?.method, JSON.parse(init?.body as string)])).toEqual([
    ['/api/admin/people', 'POST', person],
    ['/api/admin/people/p1', 'PUT', person],
    ['/api/admin/tasks', 'POST', task],
    ['/api/admin/tasks/t1', 'PUT', task],
  ])
  const headers = request.mock.calls[0][1]?.headers as Headers
  expect(headers.get('Content-Type')).toBe('application/json')
  expect(headers.get('Accept')).toBe('application/json')
  expect(headers.has('Authorization')).toBe(false)
})

it('exposes 400 validation errors by field', async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({
    title: 'Geçersiz veri', errors: { title: ['Başlık gerekli'] },
  }), { status: 400 }))
  const error = await createAdminApi(request).tasks.create({
    title: '', description: null, dueDate: null, assigneeId: null,
  }).catch((value: unknown) => value)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).fieldErrors).toEqual({ title: ['Başlık gerekli'] })
  expect((error as ApiError).warning).toBeUndefined()
})

it('deletes a task and accepts an empty response', async () => {
  const request = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) =>
    new Response(null, { status: 204 }))
  expect(await createAdminApi(request).tasks.remove('t/1')).toBeUndefined()
  expect(request.mock.calls[0][0]).toBe('/api/admin/tasks/t%2F1')
  expect(request.mock.calls[0][1]?.method).toBe('DELETE')
  expect(request.mock.calls[0][1]?.body).toBeUndefined()
})

it.each(['complete', 'reopen'] as const)('calls the task %s action', async action => {
  const task = { id: 't1', status: action === 'complete' ? 'Completed' : 'Open' }
  const request = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(task)))
  expect(await createAdminApi(request).tasks[action]('t/1')).toEqual(task)
  expect(request.mock.calls[0][0]).toBe(`/api/admin/tasks/t%2F1/${action}`)
  expect(request.mock.calls[0][1]?.method).toBe('POST')
  expect(request.mock.calls[0][1]?.body).toBeUndefined()
})

it.each(['p1', null])('assigns or unassigns a task (%s)', async assigneeId => {
  const request = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
  await createAdminApi(request).tasks.assign('t/1', assigneeId)
  expect(request.mock.calls[0][0]).toBe('/api/admin/tasks/t%2F1/assign')
  expect(request.mock.calls[0][1]?.method).toBe('POST')
  expect(JSON.parse(request.mock.calls[0][1]?.body as string)).toEqual({ assigneeId })
})

it('surfaces a deactivation warning and sends explicit confirmation on retry', async () => {
  const person = { id: 'p1', fullName: 'Ada', isActive: false }
  const request = vi.fn(async (_path: RequestInfo | URL, init?: RequestInit) => {
    const { confirm } = JSON.parse(init?.body as string) as { confirm: boolean }
    return confirm
      ? new Response(JSON.stringify(person))
      : new Response(JSON.stringify({ detail: 'Açık görevler var. Onay gerekli.' }), { status: 409 })
  })
  const admin = createAdminApi(request)
  await expect(admin.people.deactivate('p/1', false)).rejects.toMatchObject({
    status: 409, warning: 'Açık görevler var. Onay gerekli.', fieldErrors: {},
  })
  expect(await admin.people.deactivate('p/1', true)).toEqual(person)
  expect(request.mock.calls.map(([path, init]) => [path, init?.method, JSON.parse(init?.body as string)])).toEqual([
    ['/api/admin/people/p%2F1/deactivate', 'POST', { confirm: false }],
    ['/api/admin/people/p%2F1/deactivate', 'POST', { confirm: true }],
  ])
})

it('exposes 409 conflicts as warnings', async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({
    title: 'Çakışma', detail: 'Pasif kişiye görev atanamaz.',
  }), { status: 409 }))
  const error = await createAdminApi(request).people.update('p1', { fullName: 'Ada', isActive: false })
    .catch((value: unknown) => value)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(409)
  expect((error as ApiError).warning).toBe('Pasif kişiye görev atanamaz.')
  expect((error as ApiError).fieldErrors).toEqual({})
})

it('handles empty success and non-JSON errors', async () => {
  expect(await api<void>('/api/admin/tasks/t1', {}, async () => new Response(null, { status: 204 }))).toBeUndefined()
  await expect(api('/api/admin/people', {}, async () => new Response('unavailable', { status: 400 })))
    .rejects.toMatchObject({ status: 400, warning: 'İstek başarısız (400)' })
})
