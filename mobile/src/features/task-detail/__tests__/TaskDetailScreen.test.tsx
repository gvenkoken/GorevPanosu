import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TaskDetailScreen, localDate, type Dependencies } from '../TaskDetailScreen';
import { createMobileApi, type Task } from '../../../api/mobile';
import { ApiError } from '../../../api/transport';

jest.mock('../../../storage/person', () => ({ selectedPerson: { read: jest.fn() } }));
const open: Task = {
  id: 't1', title: 'Rapor hazırla', description: 'Sonuçları özetle', dueDate: '2026-11-01',
  assigneeId: 'p1', status: 'Open', createdAt: '2026-10-01T12:00:00Z', completedAt: null,
};
const completed: Task = { ...open, status: 'Completed', completedAt: '2026-10-29T10:15:00Z' };
function setup(task = open) {
  const api = {
    detail: jest.fn().mockResolvedValue(task),
    complete: jest.fn().mockResolvedValue(completed),
    reopen: jest.fn().mockResolvedValue(open),
  };
  const dependencies: Dependencies = {
    readPerson: jest.fn().mockResolvedValue('p1'), api: jest.fn(() => api),
  };
  return { api, dependencies };
}

it('shows read-only fields and uses server completion and reopening responses', async () => {
  const { api, dependencies } = setup();
  const view = await render(<TaskDetailScreen id="t1" dependencies={dependencies} />);
  await screen.findByText(open.title);
  expect(screen.getByText(open.description!)).toBeOnTheScreen();
  expect(screen.getByText(`Son tarih: ${localDate(open.dueDate!)}`)).toBeOnTheScreen();
  expect(screen.getByText(`Oluşturulma zamanı: ${localDate(open.createdAt)}`)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /sil|düzenle/i })).toBeNull();
  // Inspect the entire rendered host tree without unsupported component queries.
  expect(JSON.stringify(view.toJSON())).not.toContain('"type":"TextInput"');
  await fireEvent.press(screen.getByRole('button', { name: 'Tamamlandı olarak işaretle' }));
  expect(api.complete).toHaveBeenCalledWith('t1');
  expect(dependencies.api).toHaveBeenLastCalledWith('p1');
  expect(await screen.findByText('Durum: Tamamlandı')).toBeOnTheScreen();
  expect(screen.getByText(`Tamamlanma zamanı: ${localDate(completed.completedAt!)}`)).toBeOnTheScreen();
  expect(screen.getByText('Görev tamamlandı.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Yeniden aç' }));
  expect(api.reopen).toHaveBeenCalledWith('t1');
  expect(await screen.findByText('Durum: Açık')).toBeOnTheScreen();
  expect(screen.queryByText(/^Tamamlanma zamanı:/)).toBeNull();
  expect(screen.getByText('Görev yeniden açıldı.')).toBeOnTheScreen();
});

it.each(['Open', 'Completed'] as const)('disables the action while %s changes', async status => {
  const { api, dependencies } = setup(status === 'Open' ? open : completed);
  let finish!: (task: Task) => void;
  const action = status === 'Open' ? api.complete : api.reopen;
  action.mockImplementation(() => new Promise<Task>(resolve => { finish = resolve; }));
  await render(<TaskDetailScreen id="t1" dependencies={dependencies} />);
  await screen.findByText(open.title);
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.getByRole('button', { name: 'İşlem sürüyor…' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button'));
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => finish(status === 'Open' ? completed : open));
  expect(screen.getByRole('button')).toBeEnabled();
});

it.each(['detail', 'complete', 'reopen'] as const)('shows inaccessible state on %s 404', async operation => {
  const { api, dependencies } = setup(operation === 'reopen' ? completed : open);
  api[operation].mockRejectedValueOnce(new ApiError(404, 'Not found'));
  await render(<TaskDetailScreen id="t1" dependencies={dependencies} />);
  if (operation !== 'detail') {
    await screen.findByText(open.title);
    await fireEvent.press(screen.getByRole('button'));
  }
  expect(await screen.findByText('Görev artık erişilemiyor.')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText(open.title)).toBeNull();
});

it.each(['detail', 'complete', 'reopen'] as const)('allows retry after %s failure', async operation => {
  const { api, dependencies } = setup(operation === 'reopen' ? completed : open);
  api[operation].mockRejectedValueOnce(new ApiError(503, 'Unavailable'));
  await render(<TaskDetailScreen id="t1" dependencies={dependencies} />);
  if (operation !== 'detail') {
    await screen.findByText(open.title);
    await fireEvent.press(screen.getByRole('button'));
  }
  expect(await screen.findByRole('alert')).toHaveTextContent(/tekrar deneyin/);
  await fireEvent.press(screen.getByRole('button'));
  await screen.findByText(open.title);
  await waitFor(() => expect(api[operation]).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText(/başarısız|yüklenemedi/)).toBeNull());
});

it('sends the loaded personId for detail, complete and reopen requests', async () => {
  const send = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => open })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => completed })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => open });
  const dependencies: Dependencies = {
    readPerson: jest.fn().mockResolvedValueOnce('person 1').mockResolvedValue('other'),
    api: personId => createMobileApi(send, async () => personId),
  };
  await render(<TaskDetailScreen id="t1" dependencies={dependencies} />);
  await screen.findByText(open.title);
  await fireEvent.press(screen.getByRole('button'));
  await screen.findByText('Durum: Tamamlandı');
  await fireEvent.press(screen.getByRole('button'));
  await screen.findByText('Durum: Açık');
  for (const [index, suffix, method] of [[1, '', 'GET'], [2, '/complete', 'POST'], [3, '/reopen', 'POST']] as const) {
    expect(send).toHaveBeenNthCalledWith(index,
      expect.stringContaining(`/api/mobile/tasks/t1${suffix}?personId=person%201`),
      expect.objectContaining({ method }));
  }
  expect(dependencies.readPerson).toHaveBeenCalledTimes(1);
});
