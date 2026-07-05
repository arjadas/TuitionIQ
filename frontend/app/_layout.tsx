import { useAuthSession } from "@/src/features/auth/hooks/useAuthSession";
import { queryClient } from "@/src/lib/queryClient";
import { selectIsInitializingAuth, useAuthStore } from "@/src/store/authStore";
import { AuthLoadingScreen } from "@/src/shared/components/ui/AuthLoadingScreen";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { router, Stack, type Href } from "expo-router";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/src/lib/supabase";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const isAutoRefreshRunning = useRef(false);
  const isInitializingAuth = useAuthStore(selectIsInitializingAuth);

  const handlePasswordRecovery = useCallback(() => {
    router.replace("/(auth)/reset-password" as Href);
  }, []);

  useAuthSession({
    onPasswordRecovery: handlePasswordRecovery,
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      // Supabase web has built-in auto-refresh; no manual control needed
      return;
    }

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
      appStateSubscription.remove();
      stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (!isInitializingAuth) {
      void SplashScreen.hideAsync();
    }
  }, [isInitializingAuth]);

  if (isInitializingAuth) {
    return <AuthLoadingScreen />;
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
