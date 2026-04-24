import { queryClient } from "@/src/lib/queryClient";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";

export function resetClientSessionState(): void {
  useAuthStore.getState().clearAuth();
  useOrgStore.getState().clearOrg();
  queryClient.clear();
}