import { Redirect, Stack, type Href } from "expo-router";
import { useAuthStore } from "@/src/store/authStore";

export default function AuthLayout()
{
  const isInitialised = useAuthStore((state) => state.isInitialised);
  const session = useAuthStore((state) => state.session);
  const emailVerified = useAuthStore((state) => state.emailVerified);

  if (!isInitialised) {
    return null;
  }

  if (session && emailVerified) {
    return <Redirect href={"/home" as Href} />;
  }

  if (session && !emailVerified) {
    return <Redirect href={"/(verify)/verify-email" as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
