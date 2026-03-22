import { ENDPOINTS, MONTHS } from '@/constants/config';
import { apiClient } from '@/services/api/client';
import type {
  CreatePaymentRecordDto,
  PaymentRecord,
  UpdatePaymentStatusDto,
} from '@/types';

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

const transformPaymentRecord = (record: PaymentRecordResponse): PaymentRecord => {
  const dueDate = new Date(record.billYear, record.billMonth - 1, 10);
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
  getAll: async () => {
    const records = await apiClient.get<PaymentRecordResponse[]>(ENDPOINTS.PAYMENT_RECORDS);
    return records.map(transformPaymentRecord);
  },

  getById: async (id: number) => {
    const record = await apiClient.get<PaymentRecordResponse>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}`);
    return transformPaymentRecord(record);
  },

  getByStudentId: async (studentId: number) => {
    const records = await apiClient.get<PaymentRecordResponse[]>(
      `${ENDPOINTS.PAYMENT_RECORDS}/student/${studentId}`
    );
    return records.map(transformPaymentRecord);
  },

  create: async (data: CreatePaymentRecordDto) => {
    const record = await apiClient.post<PaymentRecordResponse>(ENDPOINTS.PAYMENT_RECORDS, data);
    return transformPaymentRecord(record);
  },

  updateStatus: (id: number, data: UpdatePaymentStatusDto) =>
    apiClient.patch<void>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}/status`, data),

  delete: (id: number) => apiClient.delete<void>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}`),
};
