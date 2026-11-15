// Where the login session is kept on the device.
// Native: the OS keychain/keystore via SecureStore (OWASP M9, insecure data storage).
// SecureStore values are capped at about 2 KB, so the session is split into chunks.
// Web: localStorage, the standard for browser sessions.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const countKey = (key: string): string => `${key}.count`;
const chunkKey = (key: string, index: number): string => `${key}.${index}`;

async function readChunkCount(key: string): Promise<number> {
  const stored = await SecureStore.getItemAsync(countKey(key));
  return stored ? Number(stored) : 0;
}

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);
    if (count === 0) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
    );
    return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readChunkCount(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    const writes: Promise<void>[] = [];
    for (let index = 0; index < count; index += 1) {
      const chunk = value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
      writes.push(SecureStore.setItemAsync(chunkKey(key, index), chunk));
    }
    for (let index = count; index < previousCount; index += 1) {
      writes.push(SecureStore.deleteItemAsync(chunkKey(key, index)));
    }
    await Promise.all(writes);
    await SecureStore.setItemAsync(countKey(key), String(count));
  },

  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key);
    await Promise.all([
      ...Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
      SecureStore.deleteItemAsync(countKey(key)),
    ]);
  },
};

const hasBrowserStorage = (): boolean => typeof localStorage !== 'undefined';

const browserStorage = {
  getItem: async (key: string): Promise<string | null> =>
    hasBrowserStorage() ? localStorage.getItem(key) : null,
  setItem: async (key: string, value: string): Promise<void> => {
    if (hasBrowserStorage()) localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (hasBrowserStorage()) localStorage.removeItem(key);
  },
};

export const sessionStorage = Platform.OS === 'web' ? browserStorage : secureStorage;
