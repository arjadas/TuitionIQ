import { useAuthSession } from "@/src/features/auth/hooks/useAuthSession";
import { queryClient } from "@/src/lib/queryClient";
import { useAuthStore } from "@/src/store/authStore";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { useEffect } from "react";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const isInitialised = useAuthStore((state) => state.isInitialised);

  useAuthSession();

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
