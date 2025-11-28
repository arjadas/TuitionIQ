import { useState, useEffect, useCallback } from 'react';
import { paymentRecordsApi } from '@/api/paymentRecords.api';
import type { PaymentRecord, CreatePaymentRecordDto, UpdatePaymentStatusDto } from '@/types';

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
      console.error('Error fetching payment records:', err);
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

  const updatePaymentStatus = async (
    id: number, 
    data: UpdatePaymentStatusDto
  ): Promise<boolean> => {
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
    return updatePaymentStatus(id, {
      isPaid: !currentStatus,
      paymentDate: !currentStatus ? new Date() : undefined,
    });
  };

  const deletePaymentRecord = async (id: number): Promise<boolean> => {
    try {
      await paymentRecordsApi.delete(id);
      await fetchPaymentRecords();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment record');
      return false;
    }
  };

  return {
    paymentRecords,
    loading,
    error,
    fetchPaymentRecords,
    createPaymentRecord,
    updatePaymentStatus,
    togglePaymentStatus,
    deletePaymentRecord,
  };
};