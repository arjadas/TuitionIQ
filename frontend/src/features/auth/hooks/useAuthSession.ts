import { useEffect } from "react";
import { AxiosError } from "axios";
import { type Session } from "@supabase/supabase-js";
import { forceClientSignOut } from "@/src/lib/forceClientSignOut";
import { queryClient } from "@/src/lib/queryClient";
import { resetClientSessionState } from "@/src/lib/resetClientSessionState";
import { supabase } from "@/src/lib/supabase";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";
import { usersMeQueryKey } from "@/src/features/users/hooks/useCurrentUser";
import { getApiErrorCode } from "@/src/shared/utils/apiError";
import { useAuthStore } from "@/src/store/authStore";

type UseAuthSessionOptions = {
  onPasswordRecovery?: () => void;
  onSignedOut?: () => void;
};

function isAccountSuspendedResponse(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  return error.response?.status === 403 && getApiErrorCode(error) === "ACCOUNT_SUSPENDED";
}

/**
 * Single source of auth truth. Driven solely by `onAuthStateChange` — supabase-js
 * emits `INITIAL_SESSION` on subscribe with the restored session, so there is no
 * separate `getSession()` path to race against.
 *
 * The readiness gate (`isInitializingAuth`) only closes AFTER email-verification
 * is resolved for an authenticated session, so route guards never observe a
 * half-resolved `(session, emailVerified)` combination.
 */
export function useAuthSession(options: UseAuthSessionOptions = {}): void {
  const { onPasswordRecovery, onSignedOut } = options;
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);
  const setInitializingAuth = useAuthStore((state) => state.setInitializingAuth);

  useEffect(() => {
    let isMounted = true;

    const applySession = (session: Session | null): void => {
      if (!isMounted) {
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
    };

    // Resolve the authoritative C# `email_verified` flag. Resilient by design:
    // a definitive 403 means unverified; a suspension forces sign-out; any other
    // (transient) failure must NOT strand the user — the non-bypassable verify
    // screen re-checks on mount and forwards to /home when actually verified.
    const resolveEmailVerified = async (): Promise<boolean> => {
      try {
        const profile = await usersApiClient.getCurrentUserProfile();
        queryClient.setQueryData(usersMeQueryKey, profile);
        return profile.emailVerified;
      } catch (error) {
        if (isAccountSuspendedResponse(error)) {
          await forceClientSignOut({ redirectTo: "/(auth)/login" });
          return false;
        }
        return false;
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      console.log("[auth/session] onAuthStateChange", { event, hasSession: Boolean(session) });

      if (event === "PASSWORD_RECOVERY") {
        applySession(session);
        onPasswordRecovery?.();
        setInitializingAuth(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        resetClientSessionState();
        setInitializingAuth(false);
        onSignedOut?.();
        return;
      }

      // Token refresh / user update: the session changed but verification did not.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        applySession(session);
        return;
      }

      // INITIAL_SESSION (bootstrap) and SIGNED_IN (fresh login).
      applySession(session);

      if (!session) {
        setInitializingAuth(false);
        return;
      }

      // Hold the loading gate up while we resolve verification — this also covers
      // the transition off the login screen so no half-resolved state is shown.
      setInitializingAuth(true);
      void (async () => {
        const verified = await resolveEmailVerified();
        if (!isMounted) {
          return;
        }
        setEmailVerified(verified);
        setInitializingAuth(false);
      })();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [onPasswordRecovery, onSignedOut, setEmailVerified, setInitializingAuth, setSession, setUser]);
}
