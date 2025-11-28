import { useState, useEffect, useCallback } from 'react';
import { paymentRecordsApi } from '@/api/paymentRecords.api';
import type { PaymentRecord, CreatePaymentRecordDto, UpdatePaymentStatusDto } from '@/types';

/**
 * Custom hook for managing payment record data with CRUD operations.
 * 
 * Provides:
 * - `paymentRecords`: Array of all payment records with computed fields (monthName, dueDate, isOverdue)
 * - `loading`: Boolean indicating if data is being fetched
 * - `error`: Error message if an operation failed
 * - `fetchPaymentRecords`: Function to refresh the payment records list
 * - `createPaymentRecord`: Function to create a new payment record
 * - `updatePaymentStatus`: Function to update payment status (paid/unpaid)
 * - `togglePaymentStatus`: Function to toggle between paid/unpaid status
 * - `deletePaymentRecord`: Function to delete a payment record
 * 
 * @returns Payment record state and CRUD operations
 * 
 * @example
 * ```tsx
 * const { paymentRecords, loading, togglePaymentStatus } = usePaymentRecords();
 * 
 * if (loading) return <Spinner />;
 * 
 * return paymentRecords.map(p => (
 *   <PaymentCard 
 *     key={p.id} 
 *     payment={p} 
 *     onToggle={() => togglePaymentStatus(p.id, p.isPaid)} 
 *   />
 * ));
 * ```
 */
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