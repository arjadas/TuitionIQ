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
  const setResolvedSession = useAuthStore((state) => state.setResolvedSession);
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
          await forceClientSignOut();
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

      if (__DEV__) {
        console.log("[auth/session] onAuthStateChange", { event, hasSession: Boolean(session) });
      }

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
      if (!session) {
        applySession(null);
        setInitializingAuth(false);
        return;
      }

      // Resolve the authoritative email_verified flag BEFORE publishing the
      // session, so the guards never observe a half-resolved (session, stale
      // emailVerified) pair and bounce a verified user toward verify-email.
      //
      // The global loading gate only matters during the initial bootstrap (its
      // initial value is true). A fresh SIGNED_IN happens while the user is still
      // on the login screen, which keeps its own spinner up until this navigation
      // unmounts it — so we must NOT re-raise the gate here. Re-raising it
      // remounted every route guard and produced the web flicker / repeated
      // history.replaceState.
      void (async () => {
        const verified = await resolveEmailVerified();
        if (!isMounted) {
          return;
        }
        // Publish session + user + emailVerified atomically, then release the gate.
        setResolvedSession(session, verified);
        setInitializingAuth(false);
      })();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [onPasswordRecovery, onSignedOut, setInitializingAuth, setResolvedSession, setSession, setUser]);
}
