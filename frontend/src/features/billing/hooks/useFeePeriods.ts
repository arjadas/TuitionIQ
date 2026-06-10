import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { FeePeriodDto, RecordPaymentRequest, SetFeeRequest, WaivePeriodRequest } from "@tuitioniq/types";
import {
  feeHistoryQueryKey,
  feePeriodsQueryKey,
  paymentsQueryKey,
} from "@/src/features/billing/hooks/billingQueryKeys";
import { billingApiClient } from "@/src/features/billing/services/billingApiClient";
import { useOrgStore } from "@/src/store/orgStore";

type ReversePaymentVariables = {
  paymentId: string;
  feePeriodId: string;
};

type WaivePeriodVariables = {
  periodId: string;
  body: WaivePeriodRequest;
};

export function useFeePeriods(studentId: string | null): UseQueryResult<FeePeriodDto[]> {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  return useQuery<FeePeriodDto[]>({
    queryKey: feePeriodsQueryKey(selectedOrgId, studentId),
    enabled: Boolean(selectedOrgId && studentId),
    queryFn: () => billingApiClient.getFeePeriods(selectedOrgId!, studentId!),
  });
}

export function useRecordPayment(studentId: string | null) {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RecordPaymentRequest) => billingApiClient.recordPayment(body),
    onSuccess: async (_, body) => {
      await queryClient.invalidateQueries({
        queryKey: feePeriodsQueryKey(selectedOrgId, studentId),
      });

      await queryClient.invalidateQueries({
        queryKey: paymentsQueryKey(selectedOrgId, studentId, body.feePeriodId),
      });
    },
  });
}

export function useReversePayment(studentId: string | null) {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId }: ReversePaymentVariables) => billingApiClient.reversePayment(paymentId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: feePeriodsQueryKey(selectedOrgId, studentId),
      });

      await queryClient.invalidateQueries({
        queryKey: paymentsQueryKey(selectedOrgId, studentId, variables.feePeriodId),
      });
    },
  });
}

export function useWaivePeriod(studentId: string | null) {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, body }: WaivePeriodVariables) => {
      if (!selectedOrgId || !studentId) {
        throw new Error("Organization and student are required to waive a period.");
      }

      return billingApiClient.waivePeriod(selectedOrgId, studentId, periodId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: feePeriodsQueryKey(selectedOrgId, studentId),
      });
    },
  });
}

export function useSetFee(studentId: string | null) {
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: SetFeeRequest) => {
      if (!selectedOrgId || !studentId) {
        throw new Error("Organization and student are required to set a fee.");
      }

      return billingApiClient.setFee(selectedOrgId, studentId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: feePeriodsQueryKey(selectedOrgId, studentId),
      });

      await queryClient.invalidateQueries({
        queryKey: feeHistoryQueryKey(selectedOrgId, studentId),
      });
    },
  });
}
