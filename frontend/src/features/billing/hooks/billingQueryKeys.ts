export const feePeriodsQueryKey = (orgId: string | null, studentId: string | null) =>
  ["billing", "periods", orgId, studentId] as const;

export const paymentsQueryKey = (
  orgId: string | null,
  studentId: string | null,
  periodId: string | null,
) => ["billing", "payments", orgId, studentId, periodId] as const;

export const feeHistoryQueryKey = (orgId: string | null, studentId: string | null) =>
  ["billing", "fees", orgId, studentId] as const;
