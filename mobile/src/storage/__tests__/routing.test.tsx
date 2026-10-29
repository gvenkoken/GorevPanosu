import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout, { PersonSelectionRoute } from '../../../app/_layout';
import { selectedPerson } from '../person';

jest.mock('../person', () => ({ selectedPerson: { read: jest.fn() } }));

const read = jest.mocked(selectedPerson.read);

beforeEach(() => { read.mockReset(); });

it('redirects to person selection when no selection is remembered', async () => {
  read.mockResolvedValue(null);
  await renderRouter({
    _layout: RootLayout,
    index: () => <Text>Görevlerim</Text>,
    'person-selection': PersonSelectionRoute,
  }, { initialUrl: '/' });
  expect(await screen.findByText('Kişi seçimi')).toBeOnTheScreen();
  expect(screen).toHavePathname('/person-selection');
});

it('keeps the requested route when a person is remembered', async () => {
  read.mockResolvedValue('person-42');
  await renderRouter({
    _layout: RootLayout,
    index: () => <Text>Görevlerim</Text>,
    'person-selection': PersonSelectionRoute,
  }, { initialUrl: '/' });
  expect(await screen.findByText('Görevlerim')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
});

it('shows a recoverable storage failure instead of treating it as an empty selection', async () => {
  read.mockRejectedValue(new Error('storage unavailable'));
  await renderRouter({
    _layout: RootLayout,
    index: () => <Text>Görevlerim</Text>,
  }, { initialUrl: '/' });
  expect(await screen.findByText('Kayıtlı kişi okunamadı.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeOnTheScreen();
});
