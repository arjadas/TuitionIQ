import { AuthLoadingScreen } from "@/src/shared/components/ui/AuthLoadingScreen";
import { useAuthStatus } from "@/src/store/authStore";
import { Redirect, Stack, useSegments, type Href } from "expo-router";

export default function AuthLayout() {
  const status = useAuthStatus();
  const segments = useSegments();
  const isResetPassword = segments[segments.length - 1] === "reset-password";
  if (__DEV__) console.log("[TEMP guard (auth)]", status, segments.join("/")); // TEMP: remove after verification

  if (status === "initializing") {
    return <AuthLoadingScreen />;
  }

  // The password-recovery screen runs with an active recovery session; let it
  // render so the guard doesn't bounce the user away mid-reset.
  if (isResetPassword) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  if (status === "authenticated") {
    return <Redirect href="/home" />;
  }

  if (status === "unverified") {
    return <Redirect href={"/(verify)/verify-email" as Href} />;
  }

  // unauthenticated — show login / signup / forgot-password
  return <Stack screenOptions={{ headerShown: false }} />;
}
