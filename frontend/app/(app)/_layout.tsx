import { AppShell } from "@/src/shared/components/nav/AppShell";
import { AuthLoadingScreen } from "@/src/shared/components/ui/AuthLoadingScreen";
import { useAuthStatus } from "@/src/store/authStore";
import { Redirect, Stack, type Href } from "expo-router";

export default function AppLayout() {
  const status = useAuthStatus();

  if (status === "initializing") {
    return <AuthLoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === "unverified") {
    return <Redirect href={"/(verify)/verify-email" as Href} />;
  }

  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }} />
    </AppShell>
  );
}
