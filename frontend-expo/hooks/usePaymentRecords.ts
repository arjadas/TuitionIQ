import { useCallback, useEffect, useState } from 'react';

import { paymentRecordsApi } from '@/services/api/paymentRecords.api';
import type { CreatePaymentRecordDto, PaymentRecord, UpdatePaymentStatusDto } from '@/types';

export const usePaymentRecords = () => {
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentRecordsApi.getAll();
      setPaymentRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payment records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentRecords();
  }, [fetchPaymentRecords]);

  const createPaymentRecord = async (data: CreatePaymentRecordDto): Promise<boolean> => {
    try {
      await paymentRecordsApi.create(data);
      await fetchPaymentRecords();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment record');
      return false;
    }
  };

  const updatePaymentStatus = async (id: number, data: UpdatePaymentStatusDto): Promise<boolean> => {
    try {
      await paymentRecordsApi.updateStatus(id, data);
      await fetchPaymentRecords();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment record');
      return false;
    }
  };

  const togglePaymentStatus = async (id: number, currentStatus: boolean): Promise<boolean> => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

    return updatePaymentStatus(id, {
      isPaid: !currentStatus,
      paymentDate: !currentStatus ? localDateString : undefined,
    });
  };

  return {
    paymentRecords,
    loading,
    error,
    fetchPaymentRecords,
    createPaymentRecord,
    updatePaymentStatus,
    togglePaymentStatus,
  };
};
