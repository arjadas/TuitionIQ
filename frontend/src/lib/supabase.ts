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

const ExpoSecureStoreAdapter: SupportedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
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
