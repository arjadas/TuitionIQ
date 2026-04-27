import { type Href, router } from "expo-router";
import { resetClientSessionState } from "@/src/lib/resetClientSessionState";
import { supabase } from "@/src/lib/supabase";

type ForceClientSignOutOptions = {
  redirectTo?: Href;
};

export async function forceClientSignOut(options: ForceClientSignOutOptions = {}): Promise<void> {
  await supabase.auth.signOut();
  resetClientSessionState();

  if (options.redirectTo) {
    router.replace(options.redirectTo);
  }
}
