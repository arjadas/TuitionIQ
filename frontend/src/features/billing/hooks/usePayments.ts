import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { FeePaymentDto } from "@tuitioniq/types";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { paymentsQueryKey } from "@/src/features/billing/hooks/billingQueryKeys";
import { billingApiClient } from "@/src/features/billing/services/billingApiClient";
import { useOrgStore } from "@/src/store/orgStore";

function resolveRouteParam(input: string | string[] | undefined): string | null {
  if (!input) {
    return null;
  }

  if (Array.isArray(input)) {
    return input[0] ?? null;
  }

  return input;
}

export function usePayments(periodId: string | null): UseQueryResult<FeePaymentDto[]> {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const params = useLocalSearchParams<{ studentId?: string | string[] }>();

  const studentId = useMemo(() => resolveRouteParam(params.studentId), [params.studentId]);

  return useQuery<FeePaymentDto[]>({
    queryKey: paymentsQueryKey(selectedOrgId, studentId, periodId),
    enabled: Boolean(selectedOrgId && studentId && periodId),
    queryFn: () => billingApiClient.getPaymentsForPeriod(periodId!, {
      orgId: selectedOrgId!,
      studentId: studentId!,
    }),
  });
}
