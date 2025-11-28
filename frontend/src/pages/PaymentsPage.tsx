import React from 'react';
import { PaymentRecordList } from '@/components/payments/PaymentList';
import type { PaymentRecord } from '@/types';

interface PaymentRecordsPageProps {
  paymentRecords: PaymentRecord[];
  onTogglePaymentRecord: (id: number, currentStatus: boolean) => void;
}

export const PaymentRecordsPage: React.FC<PaymentRecordsPageProps> = ({ paymentRecords, onTogglePaymentRecord }) => {
  return (
    <div>
      {paymentRecords.length > 0 ? (
        <PaymentRecordList paymentRecords={paymentRecords} onToggle={onTogglePaymentRecord} />
      ) : (
        <p className="text-gray-500 text-center py-8">
          No payment records yet. Create payment records to get started!
        </p>
      )}
    </div>
  );
};