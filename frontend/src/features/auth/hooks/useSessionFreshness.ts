import { supabase } from "@/src/lib/supabase";

export function useSessionFreshness()
{
  async function isSessionFresh(): Promise<boolean>
  {
    const { data, error } = await supabase.auth.getUser();
    return !error && !!data.user;
  }

  return {
    isSessionFresh,
  };
}
