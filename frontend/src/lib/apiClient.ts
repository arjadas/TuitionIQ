import axios, { type AxiosError } from "axios";
import Constants from "expo-constants";
import { router, type Href } from "expo-router";
import { Platform } from "react-native";
import { forceClientSignOut } from "@/src/lib/forceClientSignOut";
import { supabase } from "@/src/lib/supabase";
import { getApiErrorCode } from "@/src/shared/utils/apiError";
import { useAuthStore } from "@/src/store/authStore";

type ExpoHostMetadata = {
  expoConfig?: {
    hostUri?: string;
  };
  manifest2?: {
    extra?: {
      expoGo?: {
        debuggerHost?: string;
      };
    };
  };
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeConfiguredBaseUrl(configuredBaseUrl: string): string {
  const trimmed = trimTrailingSlashes(configuredBaseUrl.trim());
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

function getExpoLanHost(): string | null {
  const hostMetadata = Constants as unknown as ExpoHostMetadata;
  const hostUri = hostMetadata.expoConfig?.hostUri ?? hostMetadata.manifest2?.extra?.expoGo?.debuggerHost;
  if (!hostUri) {
    return null;
  }

  const [host] = hostUri.split(":");
  return host || null;
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!configuredBaseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL.");
  }

  const normalizedBaseUrl = normalizeConfiguredBaseUrl(configuredBaseUrl);

  if (Platform.OS === "web") {
    return normalizedBaseUrl;
  }

  try {
    const parsedBaseUrl = new URL(normalizedBaseUrl);
    if (!isLoopbackHost(parsedBaseUrl.hostname)) {
      return normalizedBaseUrl;
    }

    const expoLanHost = getExpoLanHost();
    if (!expoLanHost) {
      return normalizedBaseUrl;
    }

    parsedBaseUrl.hostname = expoLanHost;
    return trimTrailingSlashes(parsedBaseUrl.toString());
  } catch {
    return normalizedBaseUrl;
  }
}

const apiBaseUrl = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const storeSession = useAuthStore.getState().session;
  
  // OPTIMIZATION: Try store session first (already in memory from signIn response)
  // Only call getSession() if store is empty (to catch token refreshes from supabase)
  let accessToken: string | undefined = storeSession?.access_token;
  
  if (!accessToken) {
    const {
      data: { session: supabaseSession },
    } = await supabase.auth.getSession();
    accessToken = supabaseSession?.access_token;
  }

  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const statusCode = error.response?.status;
    const code = getApiErrorCode(error);

    // A 401 is intentionally NOT a forced sign-out. The Supabase SDK auto-refreshes
    // tokens and replays queued requests (authentication.md §9.1), and genuine
    // session loss is emitted via supabase.auth.onAuthStateChange("SIGNED_OUT")
    // and handled by the route guards. Forcing sign-out here turned a single
    // failed/rejected request (e.g. the post-login /api/users/me probe) into a
    // bounce back to the login screen.

    if (statusCode === 403 && code === "ACCOUNT_SUSPENDED") {
      await forceClientSignOut({ redirectTo: "/(auth)/login" });
    }

    if (statusCode === 403 && code === "EMAIL_NOT_VERIFIED") {
      useAuthStore.getState().setEmailVerified(false);
      router.replace("/(verify)/verify-email" as Href);
    }

    return Promise.reject(error);
  },
);
