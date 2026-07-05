import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RecordPaymentRequest } from "@tuitioniq/types";
import {
  feePeriodsQueryKey,
  paymentsQueryKey,
} from "@/src/features/billing/hooks/billingQueryKeys";
import { billingApiClient } from "@/src/features/billing/services/billingApiClient";
import { useOrgStore } from "@/src/store/orgStore";

export type BatchPaymentResult = {
  feePeriodId: string;
  ok: boolean;
  error?: unknown;
};

/**
 * Records one payment per selected fee period. The backend only accepts a single
 * period per POST /api/payments, so multi-month submissions are sequenced here.
 * Each request is independent; a failure on one month does not roll back the
 * others, and the per-period outcome is returned so the UI can report it.
 */
export function useRecordPayments(studentId: string | null) {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const queryClient = useQueryClient();

  return useMutation<BatchPaymentResult[], Error, RecordPaymentRequest[]>({
    mutationFn: async (requests: RecordPaymentRequest[]) => {
      const results: BatchPaymentResult[] = [];

      for (const request of requests) {
        try {
          await billingApiClient.recordPayment(request);
          results.push({ feePeriodId: request.feePeriodId, ok: true });
        } catch (error) {
          results.push({ feePeriodId: request.feePeriodId, ok: false, error });
        }
      }

      return results;
    },
    onSuccess: async (results) => {
      await queryClient.invalidateQueries({
        queryKey: feePeriodsQueryKey(selectedOrgId, studentId),
      });

      await Promise.all(
        results
          .filter((result) => result.ok)
          .map((result) =>
            queryClient.invalidateQueries({
              queryKey: paymentsQueryKey(selectedOrgId, studentId, result.feePeriodId),
            }),
          ),
      );
    },
  });
}
