import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import Home from '../../../app/index';
import Layout from '../../../app/_layout';
import SelectPerson from '../../../app/select-person';
import Tasks from '../../../app/tasks/index';
import TaskDetail from '../../../app/tasks/[id]';
import { mobileApi } from '../../../api/mobile';
import { ApiError } from '../../../api/transport';
import { assignedTasks } from '../api';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock('../../../api/mobile', () => ({
  ...jest.requireActual('../../../api/mobile'),
  mobileApi: { people: jest.fn() },
}));
jest.mock('../api', () => ({ assignedTasks: jest.fn() }));

const task = {
  id: 't1', title: 'Rapor hazırla', description: null, dueDate: '2026-11-01',
  assigneeId: 'p1', status: 'Open' as const, createdAt: '2026-10-01', completedAt: null,
};
const routes = {
  _layout: Layout, index: Home, 'select-person': SelectPerson,
  'tasks/index': Tasks, 'tasks/[id]': TaskDetail,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async () => {});
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async () => {});
  jest.mocked(mobileApi.people).mockResolvedValue([
    { id: 'p1', fullName: 'Ada', isActive: true },
    { id: 'p2', fullName: 'Pasif kişi', isActive: false },
  ]);
  jest.mocked(assignedTasks).mockResolvedValue([task,
    { ...task, id: 't2', title: 'Biten iş', status: 'Completed', completedAt: '2026-10-29' },
  ]);
});

it('opens selection with empty storage, saves an active person and opens tasks', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByRole('radio', { name: 'Ada' });
  expect(screen).toHavePathname('/select-person');
  expect(screen.queryByText('Pasif kişi')).toBeNull();
  expect(screen.queryByText(/API is ready|The API cannot be reached/)).toBeNull();
  jest.mocked(AsyncStorage.setItem).mockImplementation(async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('p1');
  });
  await fireEvent.press(screen.getByRole('radio', { name: 'Ada' }));
  await screen.findByText(task.title);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('gorevpanosu.selectedPersonId', 'p1');
  expect(screen).toHavePathname('/tasks');
  expect(screen.getByText('Tamamlananlar')).toBeOnTheScreen();
  expect(screen.getByText('Biten iş')).toBeOnTheScreen();
});

it('opens remembered tasks and navigates a card to the detail route', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('p1');
  // Keep this routing check independent of detail fetching, covered by screen tests.
  await renderRouter({ ...routes, 'tasks/[id]': () => <Text>Ayrıntı rotası</Text> }, { initialUrl: '/' });
  await screen.findByText(task.title);
  expect(screen).toHavePathname('/tasks');
  expect(screen.getAllByText('Son tarih: 2026-11-01')).toHaveLength(2);
  await fireEvent.press(screen.getByRole('button', { name: task.title }));
  await screen.findByText('Ayrıntı rotası');
  expect(screen).toHavePathname('/tasks/t1');
});

it('clears an inactive person on tasks 404 and opens selection', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('p1');
  jest.mocked(assignedTasks).mockRejectedValueOnce(new ApiError(404, 'Not found'));
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByRole('radio', { name: 'Ada' });
  expect(screen).toHavePathname('/select-person');
  expect(AsyncStorage.removeItem).toHaveBeenCalled();
});

it('retries a storage failure with Turkish feedback', async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByText('Kayıtlı kişi okunamadı.');
  await fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
  await waitFor(() => expect(screen).toHavePathname('/select-person'));
  expect(AsyncStorage.getItem).toHaveBeenCalledTimes(3);
});
