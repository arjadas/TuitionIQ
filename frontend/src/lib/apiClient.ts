import axios, { type AxiosError } from "axios";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL.");
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
});

apiClient.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const statusCode = error.response?.status;

    if (statusCode === 401) {
      await supabase.auth.signOut();
      useAuthStore.getState().clearAuth();
      useOrgStore.getState().clearOrg();
      router.replace("/login");
    }

    if (statusCode === 403) {
      await supabase.auth.signOut();
      useAuthStore.getState().clearAuth();
      useOrgStore.getState().clearOrg();
      router.replace("/login");
    }

    return Promise.reject(error);
  },
);
