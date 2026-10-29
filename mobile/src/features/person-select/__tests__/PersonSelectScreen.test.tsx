import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PersonSelectScreen, type Dependencies } from '../PersonSelectScreen';
import { ApiError } from '../../../api/transport';
import SelectPerson from '../../../../app/select-person';
import { mobileApi } from '../../../api/mobile';
import { selectedPerson } from '../../../storage/person';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../../../api/mobile', () => ({
  mobileApi: { people: jest.fn() },
  createMobileApi: jest.fn(),
}));
jest.mock('../../../storage/person', () => ({
  selectedPerson: { read: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));
const mockReplace = jest.fn();
const person = { id: 'p1', fullName: 'Ada Yılmaz', isActive: true };

function setup() {
  const dependencies: Dependencies = {
    people: jest.fn().mockResolvedValue([person, { id: 'inactive', fullName: 'Pasif Kişi', isActive: false }]),
    validate: jest.fn().mockResolvedValue([]),
    storage: {
      read: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    },
  };
  const onSelected = jest.fn();
  return { dependencies, onSelected };
}

beforeEach(() => jest.clearAllMocks());

it('shows only active API people and waits for persistence before continuing', async () => {
  const props = setup();
  let persisted = false;
  let persistedWhenSelected = false;
  jest.mocked(props.dependencies.storage.save).mockImplementation(async () => {
    expect(props.onSelected).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(props.onSelected).not.toHaveBeenCalled();
    persisted = true;
  });
  props.onSelected.mockImplementation(() => {
    persistedWhenSelected = persisted;
  });
  await render(<PersonSelectScreen {...props} />);
  const row = await screen.findByRole('radio', { name: person.fullName });
  expect(screen.queryByText('Pasif Kişi')).toBeNull();
  await fireEvent.press(row);
  expect(props.dependencies.storage.save).toHaveBeenCalledWith('p1');
  await waitFor(() => expect(props.onSelected).toHaveBeenCalledTimes(1));
  expect(persistedWhenSelected).toBe(true);
  expect(screen.getByRole('radio', { name: person.fullName }).props.accessibilityState.checked).toBe(true);
});

it('routes to the tasks entry after saving', async () => {
  jest.mocked(selectedPerson.read).mockResolvedValue(null);
  jest.mocked(selectedPerson.save).mockResolvedValue(undefined);
  jest.mocked(mobileApi.people).mockResolvedValue([person]);
  await render(<SelectPerson />);
  await fireEvent.press(await screen.findByRole('radio', { name: person.fullName }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(selectedPerson.save).toHaveBeenCalledWith(person.id);
});

it('clears a remembered person on API 404 and explains reselection', async () => {
  const props = setup();
  jest.mocked(props.dependencies.storage.read).mockResolvedValue('old');
  jest.mocked(props.dependencies.validate).mockRejectedValue(new ApiError(404, 'Not found'));
  await render(<PersonSelectScreen {...props} />);
  expect(await screen.findByText(/Hatırlanan kişi artık aktif değil/)).toBeOnTheScreen();
  expect(props.dependencies.validate).toHaveBeenCalledWith('old');
  expect(props.dependencies.storage.clear).toHaveBeenCalledTimes(1);
  const row = await screen.findByRole('radio', { name: person.fullName });
  expect(row.props.accessibilityState.checked).toBe(false);
});

it('shows loading without authentication wording', async () => {
  const props = setup();
  let finish!: (people: typeof person[]) => void;
  jest.mocked(props.dependencies.people).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(<PersonSelectScreen {...props} />);
  expect(screen.getByLabelText('Kişiler yükleniyor')).toBeOnTheScreen();
  expect(screen.queryByText(/giriş|şifre/i)).toBeNull();
  await act(async () => finish([]));
  expect(screen.getByText('Aktif kişi bulunamadı.')).toBeOnTheScreen();
});

it('retries a failed request', async () => {
  const props = setup();
  jest.mocked(props.dependencies.people).mockRejectedValueOnce(new Error('offline'));
  await render(<PersonSelectScreen {...props} />);
  expect(await screen.findByText('Kişiler yüklenemedi. Lütfen tekrar deneyin.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByRole('radio', { name: person.fullName })).toBeOnTheScreen();
  expect(props.dependencies.people).toHaveBeenCalledTimes(2);
});

it('preserves remembered selection on a non-404 API failure', async () => {
  const props = setup();
  jest.mocked(props.dependencies.storage.read).mockResolvedValue('old');
  jest.mocked(props.dependencies.validate).mockRejectedValue(new ApiError(503, 'Unavailable'));
  await render(<PersonSelectScreen {...props} />);
  await screen.findByText('Kişiler yüklenemedi. Lütfen tekrar deneyin.');
  expect(props.dependencies.storage.clear).not.toHaveBeenCalled();
});

it('keeps the screen open if saving fails', async () => {
  const props = setup();
  jest.mocked(props.dependencies.storage.save).mockRejectedValue(new Error('storage unavailable'));
  await render(<PersonSelectScreen {...props} />);
  await fireEvent.press(await screen.findByRole('radio', { name: person.fullName }));
  expect(await screen.findByText('Kişi seçimi kaydedilemedi. Lütfen tekrar deneyin.')).toBeOnTheScreen();
  expect(props.onSelected).not.toHaveBeenCalled();
});
