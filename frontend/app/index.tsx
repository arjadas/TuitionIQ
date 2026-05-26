import { AuthLoadingScreen } from "@/src/shared/components/ui/AuthLoadingScreen";
import { useAuthStatus } from "@/src/store/authStore";
import { Redirect, type Href } from "expo-router";

export default function Index() {
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

  return <Redirect href="/home" />;
}
