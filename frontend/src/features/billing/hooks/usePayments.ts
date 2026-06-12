import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { FeePaymentDto } from "@tuitioniq/types";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { paymentsQueryKey } from "@/src/features/billing/hooks/billingQueryKeys";
import { billingApiClient } from "@/src/features/billing/services/billingApiClient";
import { resolveRouteParam } from "@/src/shared/utils/resolveRouteParam";
import { useOrgStore } from "@/src/store/orgStore";

export function usePayments(
  periodId: string | null,
  studentIdOverride?: string | null,
): UseQueryResult<FeePaymentDto[]> {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const params = useLocalSearchParams<{ studentId?: string | string[] }>();

  // The org billing period-detail route has no studentId param, so callers there pass it explicitly.
  const routeStudentId = useMemo(() => resolveRouteParam(params.studentId), [params.studentId]);
  const studentId = studentIdOverride !== undefined ? studentIdOverride : routeStudentId;

  return useQuery<FeePaymentDto[]>({
    queryKey: paymentsQueryKey(selectedOrgId, studentId, periodId),
    enabled: Boolean(selectedOrgId && studentId && periodId),
    queryFn: () => billingApiClient.getPaymentsForPeriod(periodId!, {
      orgId: selectedOrgId!,
      studentId: studentId!,
    }),
  });
}
