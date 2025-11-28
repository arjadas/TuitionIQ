import { apiClient } from './client';
import { ENDPOINTS } from '@/constants/config';
import { MONTHS } from '@/constants/config';
import type { PaymentRecord, CreatePaymentRecordDto, UpdatePaymentStatusDto } from '@/types';

// Backend response type (before transformation)
interface PaymentRecordResponse {
  id: number;
  studentId: number;
  studentName: string;
  billYear: number;
  billMonth: number;
  amount: number;
  isPaid: boolean;
  paymentDate?: string;
  notes?: string;
}

// Transform backend response to frontend PaymentRecord with computed fields
const transformPaymentRecord = (record: PaymentRecordResponse): PaymentRecord => {
  const dueDate = new Date(record.billYear, record.billMonth - 1, 1); // 1st of the billing month
  const now = new Date();
  
  return {
    ...record,
    monthName: MONTHS[record.billMonth - 1],
    dueDate,
    isOverdue: !record.isPaid && dueDate < now,
    paymentDate: record.paymentDate ? new Date(record.paymentDate) : undefined,
  };
};

export const paymentRecordsApi = {
  getAll: async (params?: { studentId?: number; isPaid?: boolean; year?: number; month?: number }) => {
    const queryString = params 
      ? '?' + new URLSearchParams(
          Object.entries(params)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    const records = await apiClient.get<PaymentRecordResponse[]>(`${ENDPOINTS.PAYMENT_RECORDS}${queryString}`);
    return records.map(transformPaymentRecord);
  },
  
  getById: async (id: number) => {
    const record = await apiClient.get<PaymentRecordResponse>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}`);
    return transformPaymentRecord(record);
  },
  
  create: async (data: CreatePaymentRecordDto) => {
    const record = await apiClient.post<PaymentRecordResponse>(ENDPOINTS.PAYMENT_RECORDS, data);
    return transformPaymentRecord(record);
  },
  
  updateStatus: (id: number, data: UpdatePaymentStatusDto) => 
    apiClient.patch<void>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}/status`, data),
  
  delete: (id: number) => apiClient.delete<void>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}`),
  
  generateMonthly: (year: number, month: number) => 
    apiClient.post<{ message: string; count: number }>(
      `${ENDPOINTS.PAYMENT_RECORDS}/generate?year=${year}&month=${month}`,
      {}
    ),
};