import { AuthLoadingScreen } from "@/src/shared/components/ui/AuthLoadingScreen";
import { useAuthStatus } from "@/src/store/authStore";
import { Redirect, Stack } from "expo-router";

export default function VerifyLayout() {
  const status = useAuthStatus();
  if (__DEV__) console.log("[TEMP guard (verify)]", status); // TEMP: remove after verification

  if (status === "initializing") {
    return <AuthLoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === "authenticated") {
    return <Redirect href="/home" />;
  }

  // unverified — show the verification flow
  return <Stack screenOptions={{ headerShown: false }} />;
}
