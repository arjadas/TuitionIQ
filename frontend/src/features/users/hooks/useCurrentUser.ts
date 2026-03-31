import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { UserProfileDto } from "@tuitioniq/types";
import { apiClient } from "@/src/lib/apiClient";

export const usersMeQueryKey = ["users", "me"] as const;

async function getCurrentUser(): Promise<UserProfileDto> {
  const { data } = await apiClient.get<UserProfileDto>("/api/users/me");
  return data;
}

export function useCurrentUser(enabled = true): UseQueryResult<UserProfileDto> {
  return useQuery<UserProfileDto>({
    queryKey: usersMeQueryKey,
    queryFn: getCurrentUser,
    enabled,
  });
}
