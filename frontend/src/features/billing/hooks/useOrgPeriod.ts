import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { OrgFeePeriodDto } from "@tuitioniq/types";
import { orgPeriodQueryKey } from "@/src/features/billing/hooks/billingQueryKeys";
import { billingApiClient } from "@/src/features/billing/services/billingApiClient";
import { useOrgStore } from "@/src/store/orgStore";

export function useOrgPeriod(periodId: string | null): UseQueryResult<OrgFeePeriodDto> {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  return useQuery<OrgFeePeriodDto>({
    queryKey: orgPeriodQueryKey(selectedOrgId, periodId),
    enabled: Boolean(selectedOrgId && periodId),
    queryFn: () => billingApiClient.getOrgPeriodById(selectedOrgId!, periodId!),
  });
}
