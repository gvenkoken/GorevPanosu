import { selectedPerson } from '../storage/person';
import { request, type Fetch } from './transport';

export interface Person { id: string; fullName: string; isActive: boolean }
export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  assigneeId: string | null;
  status: 'Open' | 'Completed';
  createdAt: string;
  completedAt: string | null;
}

export function createMobileApi(
  send: Fetch = (...args) => fetch(...args),
  readPerson: () => Promise<string | null> = selectedPerson.read,
) {
  const taskPath = async (suffix = '') => {
    const personId = await readPerson();
    if (!personId?.trim()) throw new Error('Önce bir kişi seçin.');
    return `/api/mobile/tasks${suffix}?personId=${encodeURIComponent(personId)}`;
  };
  const item = (id: string) => `/${encodeURIComponent(id)}`;
  return {
    people: () => request<Person[]>('/api/mobile/people', { method: 'GET' }, send),
    tasks: async () => request<Task[]>(await taskPath(), { method: 'GET' }, send),
    detail: async (id: string) => request<Task>(await taskPath(item(id)), { method: 'GET' }, send),
    complete: async (id: string) => request<Task>(await taskPath(`${item(id)}/complete`), { method: 'POST' }, send),
    reopen: async (id: string) => request<Task>(await taskPath(`${item(id)}/reopen`), { method: 'POST' }, send),
  };
}

export const mobileApi = createMobileApi();
