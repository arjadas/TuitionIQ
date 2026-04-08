import { useAuthStore } from "@/src/store/authStore";
import { Redirect, Stack, type Href } from "expo-router";

export default function AuthLayout() {
  const isInitialised = useAuthStore((state) => state.isInitialised);
  const session = useAuthStore((state) => state.session);
  const emailVerified = useAuthStore((state) => state.emailVerified);

  if (!isInitialised) {
    return null;
  }

  if (session && emailVerified) {
    return <Redirect href="/home" />;
  }

  if (session && !emailVerified) {
    return <Redirect href={"/(verify)/verify-email" as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
