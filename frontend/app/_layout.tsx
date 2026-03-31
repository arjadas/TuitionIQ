import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";
import * as SplashScreen from "expo-splash-screen";
import { router, Stack } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import { useEffect } from "react";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isInitialised = useAuthStore((state) => state.isInitialised);
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
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session) {
          router.replace("/home");
        } else {
          clearAuth();
          clearOrg();
          router.replace("/login");
        }
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
          router.replace("/home");
          break;
        }
        case "SIGNED_OUT": {
          clearAuth();
          clearOrg();
          router.replace("/login");
          break;
        }
        case "TOKEN_REFRESHED": {
          setSession(session);
          setUser(session?.user ?? null);
          break;
        }
        default:
          break;
      }
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          supabase.auth.startAutoRefresh();
          return;
        }

        supabase.auth.stopAutoRefresh();
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [clearAuth, clearOrg, setInitialised, setSession, setUser]);

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
