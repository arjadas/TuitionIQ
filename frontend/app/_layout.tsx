import { useAuthSession } from "@/src/features/auth/hooks/useAuthSession";
import { queryClient } from "@/src/lib/queryClient";
import { useAuthStore } from "@/src/store/authStore";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { router, Stack, type Href } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/src/lib/supabase";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const appQueryClient = useQueryClient();
  const isAutoRefreshRunning = useRef(false);
  const isInitialised = useAuthStore((state) => state.isInitialised);

  const handlePasswordRecovery = useCallback(() => {
    router.replace("/(auth)/reset-password" as Href);
  }, []);

  const handleSignedOut = useCallback(() => {
    appQueryClient.clear();
  }, [appQueryClient]);

  useAuthSession({
    onPasswordRecovery: handlePasswordRecovery,
    onSignedOut: handleSignedOut,
  });

  useEffect(() => {
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
