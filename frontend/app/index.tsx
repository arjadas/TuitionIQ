import { useAuthStore } from "@/src/store/authStore";
import { Redirect, type Href } from "expo-router";

export default function Index() {
  const isInitialised = useAuthStore((state) => state.isInitialised);
  const session = useAuthStore((state) => state.session);
  const emailVerified = useAuthStore((state) => state.emailVerified);

  if (!isInitialised) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const destination = (emailVerified ? "/home" : "/(verify)/verify-email") as Href;
  return <Redirect href={destination} />;
}
