import type {
  FeePaymentDto,
  FeePeriodDto,
  RecordPaymentRequest,
  SetFeeRequest,
  StudentFeeConfigDto,
  WaivePeriodRequest,
} from "@tuitioniq/types";
import { apiClient } from "@/src/lib/apiClient";

async function getFeePeriods(orgId: string, studentId: string): Promise<FeePeriodDto[]> {
  const { data } = await apiClient.get<FeePeriodDto[]>(
    `/api/organizations/${orgId}/students/${studentId}/periods`,
  );

  return data;
}

async function getPaymentsForPeriod(
  periodId: string,
  params: { orgId: string; studentId: string },
): Promise<FeePaymentDto[]> {
  const { orgId, studentId } = params;

  const { data } = await apiClient.get<FeePaymentDto[]>(
    `/api/organizations/${orgId}/students/${studentId}/periods/${periodId}/payments`,
  );

  return data;
}

async function recordPayment(body: RecordPaymentRequest): Promise<FeePeriodDto> {
  const { data } = await apiClient.post<FeePeriodDto>("/api/payments", body);
  return data;
}

async function reversePayment(paymentId: string): Promise<FeePeriodDto> {
  const { data } = await apiClient.delete<FeePeriodDto>(`/api/payments/${paymentId}`);
  return data;
}

async function waivePeriod(
  orgId: string,
  studentId: string,
  periodId: string,
  body: WaivePeriodRequest,
): Promise<FeePeriodDto> {
  const { data } = await apiClient.patch<FeePeriodDto>(
    `/api/organizations/${orgId}/students/${studentId}/periods/${periodId}/waive`,
    body,
  );

  return data;
}

async function setFee(orgId: string, studentId: string, body: SetFeeRequest): Promise<StudentFeeConfigDto> {
  const { data } = await apiClient.post<StudentFeeConfigDto>(
    `/api/organizations/${orgId}/students/${studentId}/fees`,
    body,
  );

  return data;
}

export const billingApiClient = {
  getFeePeriods,
  getPaymentsForPeriod,
  recordPayment,
  reversePayment,
  waivePeriod,
  setFee,
};
