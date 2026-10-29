import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPersonStorage } from '../person';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
  };
});

beforeEach(async () => {
  await createPersonStorage().clear();
  jest.clearAllMocks();
});

it('remembers the selection across storage instances and clears it', async () => {
  const firstLaunch = createPersonStorage();
  expect(await firstLaunch.read()).toBeNull();
  await firstLaunch.save('person-42');
  const nextLaunch = createPersonStorage();
  expect(await nextLaunch.read()).toBe('person-42');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('gorevpanosu.selectedPersonId', 'person-42');
  await nextLaunch.clear();
  expect(await createPersonStorage().read()).toBeNull();
});

it('rejects an empty selection without persisting it', async () => {
  await expect(createPersonStorage().save('  ')).rejects.toThrow('Kişi kimliği boş olamaz.');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('propagates storage failures through an injected dependency', async () => {
  const failure = new Error('storage unavailable');
  const storage = createPersonStorage({
    getItem: async () => { throw failure; },
    setItem: async () => { throw failure; },
    removeItem: async () => { throw failure; },
  });
  await expect(storage.read()).rejects.toBe(failure);
  await expect(storage.save('person')).rejects.toBe(failure);
  await expect(storage.clear()).rejects.toBe(failure);
});
