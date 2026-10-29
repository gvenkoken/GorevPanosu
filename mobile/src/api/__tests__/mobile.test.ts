import { createMobileApi } from '../mobile';
import { ApiError, type Fetch } from '../transport';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

function setup(personId: string | null = 'person /?') {
  const send = jest.fn<ReturnType<Fetch>, Parameters<Fetch>>();
  send.mockImplementation(async () => new Response('{}', { status: 200 }));
  const read = jest.fn(async () => personId);
  return { api: createMobileApi(send, read), send, read };
}

it('exposes exactly the five permitted mobile operations', () => {
  expect(Object.keys(setup().api).sort()).toEqual(['complete', 'detail', 'people', 'reopen', 'tasks']);
});

it('uses mobile URLs and adds the stored person to every task request', async () => {
  const { api, send, read } = setup();
  await api.people();
  await api.tasks();
  await api.detail('task /?');
  await api.complete('task /?');
  await api.reopen('task /?');
  const prefix = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  expect(send.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
    [`${prefix}/api/mobile/people`, 'GET'],
    [`${prefix}/api/mobile/tasks?personId=person%20%2F%3F`, 'GET'],
    [`${prefix}/api/mobile/tasks/task%20%2F%3F?personId=person%20%2F%3F`, 'GET'],
    [`${prefix}/api/mobile/tasks/task%20%2F%3F/complete?personId=person%20%2F%3F`, 'POST'],
    [`${prefix}/api/mobile/tasks/task%20%2F%3F/reopen?personId=person%20%2F%3F`, 'POST'],
  ]);
  expect(read).toHaveBeenCalledTimes(4);
});

it('reads the current selection on each request', async () => {
  const { api, read, send } = setup('first');
  await api.tasks();
  read.mockResolvedValue('second');
  await api.tasks();
  expect(String(send.mock.calls[0][0])).toContain('personId=first');
  expect(String(send.mock.calls[1][0])).toContain('personId=second');
});

it('blocks task requests without a selected person', async () => {
  const { api, send } = setup(null);
  for (const call of [() => api.tasks(), () => api.detail('id'), () => api.complete('id'), () => api.reopen('id')]) {
    await expect(call()).rejects.toThrow('Önce bir kişi seçin.');
  }
  expect(send).not.toHaveBeenCalled();
});

it('propagates HTTP, network and storage errors without issuing extra requests', async () => {
  const { api, send } = setup();
  send.mockResolvedValueOnce(new Response('{}', { status: 403 }));
  await expect(api.complete('id')).rejects.toBeInstanceOf(ApiError);
  const failure = new Error('offline');
  send.mockRejectedValueOnce(failure);
  await expect(api.people()).rejects.toBe(failure);
  const brokenStorage = createMobileApi(send, async () => { throw failure; });
  await expect(brokenStorage.tasks()).rejects.toBe(failure);
  expect(send).toHaveBeenCalledTimes(2);
});

it('supports successful responses without a body', async () => {
  const { api, send } = setup();
  send.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(api.complete('id')).resolves.toBeUndefined();
});
