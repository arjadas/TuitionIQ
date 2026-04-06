import { supabase } from "@/src/lib/supabase";
import { organizationsMembershipsQueryKey } from "@/src/features/organizations/hooks/useOrgMemberships";
import { queryClient } from "@/src/lib/queryClient";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { router, Stack, usePathname } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import { useEffect, useRef } from "react";

void SplashScreen.preventAutoHideAsync();

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/callback";
}

function RootNavigator() {
  const pathname = usePathname();
  const appQueryClient = useQueryClient();
  const isAutoRefreshRunning = useRef(false);
  const isInitialised = useAuthStore((state) => state.isInitialised);
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setInitialised = useAuthStore((state) => state.setInitialised);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const clearOrg = useOrgStore((state) => state.clearOrg);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async (): Promise<void> => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (!currentSession) {
          clearAuth();
          clearOrg();
          appQueryClient.clear();
        }
      } catch {
        if (!isMounted) {
          return;
        }

        clearAuth();
        clearOrg();
        appQueryClient.clear();
      } finally {
        if (isMounted) {
          setInitialised(true);
        }
      }
    };

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case "SIGNED_IN": {
          setSession(session);
          setUser(session?.user ?? null);
          void appQueryClient.invalidateQueries({
            queryKey: organizationsMembershipsQueryKey,
          });
          break;
        }
        case "SIGNED_OUT": {
          clearAuth();
          clearOrg();
          appQueryClient.clear();
          break;
        }
        case "TOKEN_REFRESHED":
        case "USER_UPDATED": {
          setSession(session);
          setUser(session?.user ?? null);
          break;
        }
        default:
          break;
      }
    });

    const startAutoRefresh = (): void => {
      if (isAutoRefreshRunning.current) {
        return;
      }

      supabase.auth.startAutoRefresh();
      isAutoRefreshRunning.current = true;
    };

    const stopAutoRefresh = (): void => {
      if (!isAutoRefreshRunning.current) {
        return;
      }

      supabase.auth.stopAutoRefresh();
      isAutoRefreshRunning.current = false;
    };

    if (AppState.currentState === "active") {
      startAutoRefresh();
    }

    const appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        startAutoRefresh();
        return;
      }

      stopAutoRefresh();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
      stopAutoRefresh();
    };
  }, [appQueryClient, clearAuth, clearOrg, setInitialised, setSession, setUser]);

  useEffect(() => {
    if (!isInitialised) {
      return;
    }

    if (session) {
      if (pathname === "/" || isAuthRoute(pathname)) {
        router.replace("/home");
      }
      return;
    }

    if (!isAuthRoute(pathname)) {
      router.replace("/login");
    }
  }, [isInitialised, pathname, session]);

  useEffect(() => {
    if (isInitialised) {
      void SplashScreen.hideAsync();
    }
  }, [isInitialised]);

  if (!isInitialised) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
