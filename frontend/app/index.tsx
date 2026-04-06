import { useAuthStore } from "@/src/store/authStore";
import { Redirect } from "expo-router";

export default function Index() {
  const isInitialised = useAuthStore((state) => state.isInitialised);
  const session = useAuthStore((state) => state.session);

  if (!isInitialised) {
    return null;
  }

  return <Redirect href={session ? "/home" : "/login"} />;
}
