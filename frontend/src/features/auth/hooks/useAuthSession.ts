import { useEffect } from "react";
import { AxiosError } from "axios";
import { authService } from "@/src/features/auth/services/authService";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";
import { supabase } from "@/src/lib/supabase";
import { getApiErrorCode } from "@/src/shared/utils/apiError";
import { useAuthStore } from "@/src/store/authStore";

type UseAuthSessionOptions = {
  onPasswordRecovery?: () => void;
  onSignedOut?: () => void;
};

function isEmailNotVerifiedResponse(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const code = getApiErrorCode(error);
  if (error.response?.status !== 403) {
    return false;
  }

  if (code === "EMAIL_NOT_VERIFIED") {
    return true;
  }

  const requestUrl = error.config?.url;
  return requestUrl === "/api/users/me";
}

function isAccountSuspendedResponse(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const code = getApiErrorCode(error);
  return error.response?.status === 403 && code === "ACCOUNT_SUSPENDED";
}

function isInvalidRefreshTokenError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) {
    return false;
  }

  return errorMessage.toLowerCase().includes("invalid refresh token");
}

export function useAuthSession(options: UseAuthSessionOptions = {}): void {
  const { onPasswordRecovery, onSignedOut } = options;
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);
  const setInitialised = useAuthStore((state) => state.setInitialised);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    let isMounted = true;

    const applySessionState = (session: Awaited<ReturnType<typeof authService.getSession>>["data"]["session"]): void => {
      if (!isMounted) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        setEmailVerified(false);
      }
    };

    const syncEmailVerification = async (
      session: Awaited<ReturnType<typeof authService.getSession>>["data"]["session"],
    ): Promise<void> => {
      if (!session) {
        return;
      }

      try {
        const profile = await usersApiClient.getCurrentUserProfile();
        if (isMounted) {
          setEmailVerified(profile.emailVerified);
        }
      } catch (error) {
        if (isEmailNotVerifiedResponse(error)) {
          if (isMounted) {
            setEmailVerified(false);
          }
          return;
        }

        if (isAccountSuspendedResponse(error)) {
          await authService.signOut();
          if (isMounted) {
            clearAuth();
          }
          return;
        }

        if (isMounted) {
          setEmailVerified(false);
        }
      }
    };

    void (async () => {
      const {
        data: { session },
        error,
      } = await authService.getSession();

      if (error) {
        console.log("[auth/session] getSession failed", { message: error.message });

        if (isInvalidRefreshTokenError(error.message)) {
          await authService.signOut();
          if (isMounted) {
            clearAuth();
            setInitialised(true);
          }
          return;
        }

        if (isMounted) {
          setInitialised(true);
        }
        return;
      }

      applySessionState(session);
      await syncEmailVerification(session);

      if (isMounted) {
        setInitialised(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      
      console.log("[auth/session] onAuthStateChange", { event, hasSession: Boolean(session) });

      applySessionState(session);

      if (event === "PASSWORD_RECOVERY") {
        onPasswordRecovery?.();
      }

      if (event === "SIGNED_OUT") {
        if (isMounted) {
          clearAuth();
          setInitialised(true);
        }

        onSignedOut?.();
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void syncEmailVerification(session);
      }

      if (isMounted) {
        setInitialised(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearAuth, onPasswordRecovery, onSignedOut, setEmailVerified, setInitialised, setSession, setUser]);
}
