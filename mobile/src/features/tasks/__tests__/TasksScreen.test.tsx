import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TasksScreen, type Dependencies } from '../TasksScreen';
import { ApiError } from '../../../api/transport';
import type { Task } from '../../../api/mobile';

jest.mock('../../../storage/person', () => ({ selectedPerson: { read: jest.fn(), clear: jest.fn() } }));
const now = Date.parse('2026-10-29T12:00:00Z');
const task: Task = { id: 't1', title: 'Rapor hazırla', description: null, dueDate: '2026-11-01',
  assigneeId: 'p1', status: 'Open', createdAt: '2026-10-01T12:00:00Z', completedAt: null };
function setup(items: Task[] = [task]) {
  let active = () => {};
  const unsubscribe = jest.fn();
  const dependencies: Dependencies = {
    readPerson: jest.fn().mockResolvedValue('p1'), clearPerson: jest.fn().mockResolvedValue(undefined),
    people: jest.fn().mockResolvedValue([{ id: 'p1', fullName: 'Ada Yılmaz', isActive: true }]),
    tasks: jest.fn().mockResolvedValue(items), now: () => now,
    subscribe: callback => { active = callback; return unsubscribe; },
  };
  return { dependencies, onSelectPerson: jest.fn(), onTask: jest.fn(), activate: () => active(), unsubscribe };
}

it('shows assigned open and recent completed tasks, dates and read-only navigation', async () => {
  const props = setup([task,
    { ...task, id: 'done', title: 'Bitti', status: 'Completed', completedAt: '2026-10-28T12:00:00Z' },
    { ...task, id: 'old', title: 'Eski', status: 'Completed', completedAt: '2026-09-28T12:00:00Z' },
    { ...task, id: 'other', title: 'Başkasının', assigneeId: 'p2' },
    { ...task, id: 'none', title: 'Atanmamış', assigneeId: null }]);
  await render(<TasksScreen {...props} />);
  expect(await screen.findByText('Ada Yılmaz')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Açık görevler' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Tamamlananlar' })).toBeOnTheScreen();
  expect(screen.getAllByText('Son tarih: 2026-11-01')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Bitti' })).toBeOnTheScreen();
  for (const title of ['Eski', 'Başkasının', 'Atanmamış']) expect(screen.queryByText(title)).toBeNull();
  expect(screen.queryByRole('button', { name: /oluştur|düzenle|sil/i })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: task.title }));
  expect(props.onTask).toHaveBeenCalledWith('t1');
  await fireEvent.press(screen.getByRole('button', { name: 'Kişi değiştir' }));
  expect(props.onSelectPerson).toHaveBeenCalledTimes(1);
});

it('refreshes on pull and foreground events and removes the subscription', async () => {
  const props = setup();
  const view = await render(<TasksScreen {...props} />);
  await screen.findByText(task.title);
  expect(props.dependencies.tasks).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId('tasks-list'), 'refresh');
  await waitFor(() => expect(props.dependencies.tasks).toHaveBeenCalledTimes(2));
  await act(async () => props.activate());
  await waitFor(() => expect(props.dependencies.tasks).toHaveBeenCalledTimes(3));
  await view.unmount();
  expect(props.unsubscribe).toHaveBeenCalled();
});

it('shows loading and empty sections', async () => {
  const props = setup();
  let finish!: (tasks: Task[]) => void;
  jest.mocked(props.dependencies.tasks).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(<TasksScreen {...props} />);
  expect(screen.getByLabelText('Görevler yükleniyor')).toBeOnTheScreen();
  await act(async () => finish([]));
  expect(screen.getByText('Açık göreviniz yok.')).toBeOnTheScreen();
  expect(screen.getByText('Son 30 günde tamamlanan göreviniz yok.')).toBeOnTheScreen();
});

it('retries failures without clearing the selection', async () => {
  const props = setup();
  jest.mocked(props.dependencies.tasks).mockRejectedValueOnce(new ApiError(503, 'Unavailable'));
  await render(<TasksScreen {...props} />);
  await screen.findByRole('alert');
  await fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByText(task.title)).toBeOnTheScreen();
  expect(props.dependencies.tasks).toHaveBeenCalledTimes(2);
  expect(props.dependencies.clearPerson).not.toHaveBeenCalled();
});

it('clears a missing person and requests person selection on 404', async () => {
  const props = setup();
  jest.mocked(props.dependencies.tasks).mockRejectedValue(new ApiError(404, 'Not found'));
  await render(<TasksScreen {...props} />);
  await waitFor(() => expect(props.onSelectPerson).toHaveBeenCalledTimes(1));
  expect(props.dependencies.clearPerson).toHaveBeenCalledTimes(1);
});
