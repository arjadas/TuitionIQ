import { Redirect, Stack, type Href } from "expo-router";
import { useAuthStore } from "@/src/store/authStore";

export default function VerifyLayout()
{
  const isInitialised = useAuthStore((state) => state.isInitialised);
  const session = useAuthStore((state) => state.session);
  const emailVerified = useAuthStore((state) => state.emailVerified);

  if (!isInitialised) {
    return null;
  }

  if (!session) {
    return <Redirect href={"/(auth)/login" as Href} />;
  }

  if (emailVerified) {
    return <Redirect href={"/home" as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
