import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

// ! means that this value is guaranteed to be defined.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.");
}

type BasicWebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const webStorage = (globalThis as { localStorage?: BasicWebStorage }).localStorage;
const isBrowserWeb = Platform.OS === "web" && !!webStorage;
const SECURE_STORE_CHUNK_SIZE = 1800;
const SECURE_STORE_META_SUFFIX = "__chunk_count";
const SECURE_STORE_CHUNK_SUFFIX = "__chunk_";

function getChunkCountKey(key: string): string {
  return `${key}${SECURE_STORE_META_SUFFIX}`;
}

function getChunkKey(key: string, index: number): string {
  return `${key}${SECURE_STORE_CHUNK_SUFFIX}${index}`;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += SECURE_STORE_CHUNK_SIZE) {
    chunks.push(value.slice(index, index + SECURE_STORE_CHUNK_SIZE));
  }

  return chunks;
}

async function clearChunkedValue(key: string): Promise<void> {
  const chunkCountValue = await SecureStore.getItemAsync(getChunkCountKey(key));
  const chunkCount = Number.parseInt(chunkCountValue ?? "0", 10);

  if (!Number.isNaN(chunkCount) && chunkCount > 0) {
    const deletions = Array.from({ length: chunkCount }, (_, index) =>
      SecureStore.deleteItemAsync(getChunkKey(key, index)));
    await Promise.all(deletions);
  }

  await SecureStore.deleteItemAsync(getChunkCountKey(key));
}

const ExpoSecureStoreAdapter: SupportedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const directValue = await SecureStore.getItemAsync(key);
    if (directValue !== null) {
      return directValue;
    }

    const chunkCountValue = await SecureStore.getItemAsync(getChunkCountKey(key));
    const chunkCount = Number.parseInt(chunkCountValue ?? "0", 10);
    if (Number.isNaN(chunkCount) || chunkCount <= 0) {
      return null;
    }

    const chunkReads = Array.from({ length: chunkCount }, (_, index) =>
      SecureStore.getItemAsync(getChunkKey(key, index)));
    const chunks = await Promise.all(chunkReads);
    if (chunks.some((chunk) => chunk === null)) {
      return null;
    }

    return chunks.join("");
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await clearChunkedValue(key);

    if (value.length <= SECURE_STORE_CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    await SecureStore.deleteItemAsync(key);

    const chunks = splitIntoChunks(value);
    await SecureStore.setItemAsync(getChunkCountKey(key), String(chunks.length));

    const chunkWrites = chunks.map((chunk, index) => SecureStore.setItemAsync(getChunkKey(key, index), chunk));
    await Promise.all(chunkWrites);
  },
  removeItem: async (key: string): Promise<void> => {
    await clearChunkedValue(key);
    await SecureStore.deleteItemAsync(key);
  },
};

const WebStorageAdapter: SupportedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return webStorage?.getItem(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    webStorage?.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    webStorage?.removeItem(key);
  },
};

const NoopStorageAdapter: SupportedStorage = {
  getItem: async (): Promise<string | null> => {
    return null;
  },
  setItem: async (): Promise<void> => {},
  removeItem: async (): Promise<void> => {},
};

const authStorage: SupportedStorage =
  Platform.OS === "web"
    ? isBrowserWeb
      ? WebStorageAdapter
      : NoopStorageAdapter
    : ExpoSecureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isBrowserWeb,
  },
});
