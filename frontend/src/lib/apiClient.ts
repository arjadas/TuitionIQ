import axios, { AxiosError } from "axios";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";

type ApiErrorBody = {
  code?: string;
  message?: string;
  detail?: string;
  title?: string;
};

export class ApiClientError extends Error
{
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string)
  {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

function getResponseMessage(body: ApiErrorBody | undefined, fallback: string): string
{
  if (!body) {
    return fallback;
  }

  if (typeof body.detail === "string" && body.detail.trim().length > 0) {
    return body.detail;
  }

  if (typeof body.message === "string" && body.message.trim().length > 0) {
    return body.message;
  }

  if (typeof body.title === "string" && body.title.trim().length > 0) {
    return body.title;
  }

  return fallback;
}

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!baseUrl) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL.");
}

export const apiClient = axios.create({
  baseURL: baseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const storeSession = useAuthStore.getState().session;
  let accessToken = storeSession?.access_token;

  if (!accessToken) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

    accessToken = session?.access_token;
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
    const status = error.response?.status;
    const body = error.response?.data as ApiErrorBody | undefined;
    const code = body?.code;

    if (status === 401) {
      await supabase.auth.signOut();
      useAuthStore.getState().clearAuth();
      useOrgStore.getState().clearOrg();
      throw new ApiClientError("Your session expired. Please sign in again.", 401, "SESSION_EXPIRED");
    }

    if (status === 403) {
      if (code === "ACCOUNT_SUSPENDED") {
        await supabase.auth.signOut();
        useAuthStore.getState().clearAuth();
        useOrgStore.getState().clearOrg();
        throw new ApiClientError("Your account is suspended.", 403, code);
      }

      if (code === "EMAIL_NOT_VERIFIED") {
        useAuthStore.getState().setEmailVerified(false);
        throw new ApiClientError("Please verify your email to continue.", 403, code);
      }

      throw new ApiClientError(
        getResponseMessage(body, "Access denied for this action."),
        403,
        code,
      );
    }

    return Promise.reject(error);
  },
);

export function isApiClientError(error: unknown): error is ApiClientError
{
  return error instanceof ApiClientError;
}
