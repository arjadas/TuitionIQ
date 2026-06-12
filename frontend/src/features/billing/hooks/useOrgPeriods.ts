import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { OrgFeePeriodDto } from "@tuitioniq/types";
import { orgPeriodsQueryKey } from "@/src/features/billing/hooks/billingQueryKeys";
import { billingApiClient } from "@/src/features/billing/services/billingApiClient";
import { useOrgStore } from "@/src/store/orgStore";

type UseOrgPeriodsParams = {
  year: number;
  month: number;
  status?: string;
};

export function useOrgPeriods(params: UseOrgPeriodsParams): UseQueryResult<OrgFeePeriodDto[]> {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  return useQuery<OrgFeePeriodDto[]>({
    queryKey: orgPeriodsQueryKey(selectedOrgId, params.year, params.month, params.status ?? null),
    enabled: Boolean(selectedOrgId),
    queryFn: () =>
      billingApiClient.getOrgPeriods(selectedOrgId!, {
        year: params.year,
        month: params.month,
        status: params.status,
      }),
  });
}
