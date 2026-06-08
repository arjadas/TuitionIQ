import { AuthLoadingScreen } from "@/src/shared/components/ui/AuthLoadingScreen";
import { useAuthStatus } from "@/src/store/authStore";
import { Redirect, Stack, type Href } from "expo-router";

export default function AppLayout() {
  const status = useAuthStatus();
  if (__DEV__) console.log("[TEMP guard (app)]", status); // TEMP: remove after verification

  if (status === "initializing") {
    return <AuthLoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === "unverified") {
    return <Redirect href={"/(verify)/verify-email" as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
