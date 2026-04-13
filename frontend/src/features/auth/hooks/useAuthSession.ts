import { useEffect } from "react";
import { router } from "expo-router";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { isApiClientError } from "@/src/lib/apiClient";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";

export function useAuthSession(): void
{
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);
  const setInitialised = useAuthStore((state) => state.setInitialised);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const clearOrg = useOrgStore((state) => state.clearOrg);

  useEffect(() => {
    let mounted = true;

    const syncEmailVerificationStatus = async (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"],
    ): Promise<void> => {
      if (!mounted || !session) {
        return;
      }

      try {
        const profile = await usersApiClient.getCurrentUserProfile();
        if (mounted) {
          setEmailVerified(profile.emailVerified);
        }
      } catch (error) {
        if (isApiClientError(error) && error.code === "EMAIL_NOT_VERIFIED") {
          if (mounted) {
            setEmailVerified(false);
          }
          return;
        }

        if (mounted) {
          setEmailVerified(false);
        }
      }
    };

    const applySession = async (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"],
    ): Promise<void> => {
      if (!mounted) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        setEmailVerified(false);
        return;
      }

      await syncEmailVerificationStatus(session);
    };

    const handleSignedOut = (): void => {
      clearAuth();
      clearOrg();
      router.replace("/(auth)/login");
    };

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await applySession(session);
      if (mounted) {
        setInitialised(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        handleSignedOut();
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        router.replace("/(auth)/reset-password");
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") {
        void applySession(session);
      }

      if (mounted) {
        setInitialised(true);
      }
    });

    let appStateSubscription: { remove: () => void } | null = null;

    if (Platform.OS !== "web") {
      appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
        if (state === "active") {
          supabase.auth.startAutoRefresh();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      });
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== "web") {
        supabase.auth.stopAutoRefresh();
      }
    };
  }, [
    clearAuth,
    clearOrg,
    setEmailVerified,
    setInitialised,
    setSession,
    setUser,
  ]);
}
