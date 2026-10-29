import { api } from './client'
import type { Fetch } from './client'

export interface PersonInput { fullName: string; isActive: boolean }
export interface Person extends PersonInput { id: string }
export interface TaskInput {
  title: string
  description: string | null
  dueDate: string | null
  assigneeId: string | null
}
export interface Task extends TaskInput {
  id: string
  status: 'Open' | 'Completed'
  createdAt: string
  completedAt: string | null
}

export function createAdminApi(request: Fetch = fetch) {
  const call = <T>(path: string, method = 'GET', body?: unknown) =>
    api<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, request)
  const item = (collection: string, id: string) => `/api/admin/${collection}/${encodeURIComponent(id)}`
  return {
    tasks: {
      list: () => call<Task[]>('/api/admin/tasks'),
      get: (id: string) => call<Task>(item('tasks', id)),
      create: (input: TaskInput) => call<Task>('/api/admin/tasks', 'POST', input),
      update: (id: string, input: TaskInput) => call<Task>(item('tasks', id), 'PUT', input),
    },
    people: {
      list: () => call<Person[]>('/api/admin/people'),
      get: (id: string) => call<Person>(item('people', id)),
      create: (input: PersonInput) => call<Person>('/api/admin/people', 'POST', input),
      update: (id: string, input: PersonInput) => call<Person>(item('people', id), 'PUT', input),
    },
  }
}
