import React from 'react';
import { PaymentRecordCard } from './PaymentCard';
import type { PaymentRecord } from '@/types';

interface PaymentRecordListProps {
  paymentRecords: PaymentRecord[];
  onToggle: (id: number, currentStatus: boolean) => void;
}

export const PaymentRecordList: React.FC<PaymentRecordListProps> = ({ paymentRecords, onToggle }) => {
  return (
    <div className="space-y-3">
      {paymentRecords.map((paymentRecord) => (
        <PaymentRecordCard
          key={paymentRecord.id}
          paymentRecord={paymentRecord}
          onToggle={() => onToggle(paymentRecord.id, paymentRecord.isPaid)}
        />
      ))}
    </div>
  );
};