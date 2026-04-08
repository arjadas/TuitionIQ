import axios, { type AxiosError } from "axios";
import Constants from "expo-constants";
import { router, type Href } from "expo-router";
import { Platform } from "react-native";
import { queryClient } from "@/src/lib/queryClient";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";

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
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const statusCode = error.response?.status;
    const responseData = error.response?.data as { code?: string } | undefined;
    const code = responseData?.code;

    if (statusCode === 401) {
      await supabase.auth.signOut();
      useAuthStore.getState().clearAuth();
      useOrgStore.getState().clearOrg();
      queryClient.clear();
      router.replace("/(auth)/login");
    }

    if (statusCode === 403 && code === "ACCOUNT_SUSPENDED") {
      await supabase.auth.signOut();
      useAuthStore.getState().clearAuth();
      useOrgStore.getState().clearOrg();
      queryClient.clear();
      router.replace("/(auth)/login");
    }

    if (statusCode === 403 && code === "EMAIL_NOT_VERIFIED") {
      useAuthStore.getState().setEmailVerified(false);
      router.replace("/(verify)/verify-email" as Href);
    }

    return Promise.reject(error);
  },
);
