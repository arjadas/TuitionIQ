import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { StudentFeeConfigDto } from "@tuitioniq/types";
import { feeHistoryQueryKey } from "@/src/features/billing/hooks/billingQueryKeys";
import { billingApiClient } from "@/src/features/billing/services/billingApiClient";
import { useOrgStore } from "@/src/store/orgStore";

export function useFeeHistory(studentId: string | null): UseQueryResult<StudentFeeConfigDto[]> {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  return useQuery<StudentFeeConfigDto[]>({
    queryKey: feeHistoryQueryKey(selectedOrgId, studentId),
    enabled: Boolean(selectedOrgId && studentId),
    queryFn: () => billingApiClient.getFeeHistory(selectedOrgId!, studentId!),
  });
}
