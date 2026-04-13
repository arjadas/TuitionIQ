import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.");
}

type BrowserStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const secureStoreChunkSize = 1800;
const secureStoreChunkCountSuffix = "__chunk_count";
const secureStoreChunkSuffix = "__chunk_";

function getChunkCountKey(key: string): string {
  return `${key}${secureStoreChunkCountSuffix}`;
}

function getChunkKey(key: string, index: number): string {
  return `${key}${secureStoreChunkSuffix}${index}`;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += secureStoreChunkSize) {
    chunks.push(value.slice(index, index + secureStoreChunkSize));
  }

  return chunks;
}

async function removeChunkedValue(key: string): Promise<void> {
  const countValue = await SecureStore.getItemAsync(getChunkCountKey(key));
  const chunkCount = Number.parseInt(countValue ?? "0", 10);

  if (!Number.isNaN(chunkCount) && chunkCount > 0) {
    await Promise.all(
      Array.from({ length: chunkCount }, (_, index) => SecureStore.deleteItemAsync(getChunkKey(key, index))),
    );
  }

  await SecureStore.deleteItemAsync(getChunkCountKey(key));
}

const ExpoSecureStoreAdapter: SupportedStorage = {
  getItem: async (key): Promise<string | null> => {
    const directValue = await SecureStore.getItemAsync(key);
    if (directValue !== null) {
      return directValue;
    }

    const countValue = await SecureStore.getItemAsync(getChunkCountKey(key));
    const chunkCount = Number.parseInt(countValue ?? "0", 10);
    if (Number.isNaN(chunkCount) || chunkCount <= 0) {
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) => SecureStore.getItemAsync(getChunkKey(key, index))),
    );

    if (chunks.some((value) => value === null)) {
      return null;
    }

    return chunks.join("");
  },
  setItem: async (key, value): Promise<void> => {
    await removeChunkedValue(key);

    if (value.length <= secureStoreChunkSize) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    await SecureStore.deleteItemAsync(key);

    const chunks = splitIntoChunks(value);
    await SecureStore.setItemAsync(getChunkCountKey(key), String(chunks.length));

    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(getChunkKey(key, index), chunk)));
  },
  removeItem: async (key): Promise<void> => {
    await removeChunkedValue(key);
    await SecureStore.deleteItemAsync(key);
  },
};

const browserLocalStorage =
  Platform.OS === "web" && typeof globalThis !== "undefined"
    ? (globalThis as { localStorage?: BrowserStorage }).localStorage
    : undefined;

const BrowserStorageAdapter: SupportedStorage = {
  getItem: async (key): Promise<string | null> => browserLocalStorage?.getItem(key) ?? null,
  setItem: async (key, value): Promise<void> => {
    browserLocalStorage?.setItem(key, value);
  },
  removeItem: async (key): Promise<void> => {
    browserLocalStorage?.removeItem(key);
  },
};

const NoopStorageAdapter: SupportedStorage = {
  getItem: async (): Promise<string | null> => null,
  setItem: async (): Promise<void> => {},
  removeItem: async (): Promise<void> => {},
};

const authStorage: SupportedStorage =
  Platform.OS === "web"
    ? browserLocalStorage
      ? BrowserStorageAdapter
      : NoopStorageAdapter
    : ExpoSecureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web" && !!browserLocalStorage,
  },
});
