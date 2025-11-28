import React from 'react';
import { PaymentRecordCard } from '@/components/payments/PaymentCard';
import type { PaymentRecord } from '@/types';

interface DashboardProps {
  paymentRecords: PaymentRecord[];
  onTogglePaymentRecord: (id: number, currentStatus: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ paymentRecords, onTogglePaymentRecord }) => {
  const recentPaymentRecords = paymentRecords.slice(0, 5);
  const overduePaymentRecords = paymentRecords.filter((p) => p.isOverdue);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {recentPaymentRecords.map((paymentRecord) => (
              <PaymentRecordCard
                key={paymentRecord.id}
                paymentRecord={paymentRecord}
                onToggle={() => onTogglePaymentRecord(paymentRecord.id, paymentRecord.isPaid)}
              />
            ))}
          </div>
        </div>

        {/* Overdue Payments */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-red-600">
            Overdue Payments ({overduePaymentRecords.length})
          </h3>
          <div className="space-y-3">
            {overduePaymentRecords.slice(0, 5).map((paymentRecord) => (
              <PaymentRecordCard
                key={paymentRecord.id}
                paymentRecord={paymentRecord}
                onToggle={() => onTogglePaymentRecord(paymentRecord.id, paymentRecord.isPaid)}
                highlight={true}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};