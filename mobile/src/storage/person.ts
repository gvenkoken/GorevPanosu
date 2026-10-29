import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersonStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const key = 'gorevpanosu.selectedPersonId';

export function createPersonStorage(storage?: PersonStorage) {
  const resolve = (): PersonStorage =>
    storage ?? AsyncStorage;
  return {
    read: async () => resolve().getItem(key),
    save: async (personId: string) => {
      if (!personId.trim()) throw new Error('Kişi kimliği boş olamaz.');
      return resolve().setItem(key, personId);
    },
    clear: async () => resolve().removeItem(key),
  };
}

export const selectedPerson = createPersonStorage();
