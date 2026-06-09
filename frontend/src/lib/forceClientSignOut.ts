import { resetClientSessionState } from "@/src/lib/resetClientSessionState";
import { supabase } from "@/src/lib/supabase";

/**
 * Sign out locally and clear all client session state.
 *
 * Navigation is intentionally NOT performed here. `supabase.auth.signOut()`
 * emits `SIGNED_OUT`, which `useAuthSession` handles by resetting the stores;
 * the derived `authStatus` then becomes `unauthenticated` and the route guards
 * redirect to `/(auth)/login` exactly once. Keeping the data layer free of
 * imperative navigation makes the guards the sole navigator (authentication.md §9.2).
 */
export async function forceClientSignOut(): Promise<void> {
  await supabase.auth.signOut();
  resetClientSessionState();
}
