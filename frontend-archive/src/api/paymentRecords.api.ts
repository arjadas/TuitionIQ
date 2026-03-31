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
  const dueDate = new Date(record.billYear, record.billMonth - 1, 10); // 10th of the billing month
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
  /**
   * Fetches all payment records.
   */
  getAll: async () => {
    const records = await apiClient.get<PaymentRecordResponse[]>(ENDPOINTS.PAYMENT_RECORDS);
    return records.map(transformPaymentRecord);
  },

  /**
   * Fetches a single payment record by ID.
   */
  getById: async (id: number) => {
    const record = await apiClient.get<PaymentRecordResponse>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}`);
    return transformPaymentRecord(record);
  },

  /**
   * Fetches all payment records for a specific student.
   */
  getByStudentId: async (studentId: number) => {
    const records = await apiClient.get<PaymentRecordResponse[]>(
      `${ENDPOINTS.PAYMENT_RECORDS}/student/${studentId}`
    );
    return records.map(transformPaymentRecord);
  },

  /**
   * Creates a new payment record.
   */
  create: async (data: CreatePaymentRecordDto) => {
    const record = await apiClient.post<PaymentRecordResponse>(ENDPOINTS.PAYMENT_RECORDS, data);
    return transformPaymentRecord(record);
  },

  /**
   * Updates the payment status of a record.
   */
  updateStatus: (id: number, data: UpdatePaymentStatusDto) =>
    apiClient.patch<void>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}/status`, data),

  /**
   * Deletes a payment record.
   */
  delete: (id: number) => apiClient.delete<void>(`${ENDPOINTS.PAYMENT_RECORDS}/${id}`),
};