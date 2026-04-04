import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { MembershipDto } from "@tuitioniq/types";
import { useEffect } from "react";
import { organizationsApiClient } from "@/src/features/organizations/services/organizationsApiClient";
import { useOrgStore } from "@/src/store/orgStore";

export const organizationsMembershipsQueryKey = ["organizations", "memberships"] as const;

type UseOrgMembershipsOptions = {
  enabled?: boolean;
};

export function useOrgMemberships(
  options?: UseOrgMembershipsOptions,
): UseQueryResult<MembershipDto[]> {
  const setMemberships = useOrgStore((state) => state.setMemberships);

  const query = useQuery<MembershipDto[]>({
    queryKey: organizationsMembershipsQueryKey,
    queryFn: organizationsApiClient.getMyMemberships,
    enabled: options?.enabled ?? true,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (query.isSuccess) {
      setMemberships(query.data);
    }
  }, [query.data, query.isSuccess, setMemberships]);

  return query;
}
