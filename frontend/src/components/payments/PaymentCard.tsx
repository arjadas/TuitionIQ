import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { PaymentRecord } from '@/types';
import { formatDate } from '@/utils/date.utils';
import { formatCurrency } from '@/utils/currency.utils';

interface PaymentRecordCardProps {
  paymentRecord: PaymentRecord;
  onToggle: () => void;
  highlight?: boolean;
}

export const PaymentRecordCard: React.FC<PaymentRecordCardProps> = ({ paymentRecord, onToggle, highlight }) => {
  return (
    <div
      className={`border rounded-lg p-4 ${
        highlight ? 'border-red-300 bg-red-50' : 'bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="font-semibold">{paymentRecord.studentName}</h4>
            <span className="text-sm text-gray-600">
              {paymentRecord.monthName} {paymentRecord.billYear}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="font-medium">{formatCurrency(paymentRecord.amount)}</span>
            <span className="text-gray-600">Due: {formatDate(paymentRecord.dueDate)}</span>
            {paymentRecord.paymentDate && (
              <span className="text-green-600">Paid: {formatDate(paymentRecord.paymentDate)}</span>
            )}
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            paymentRecord.isPaid
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {paymentRecord.isPaid ? (
            <>
              <CheckCircle size={18} />
              Paid
            </>
          ) : (
            <>
              <XCircle size={18} />
              Unpaid
            </>
          )}
        </button>
      </div>
    </div>
  );
};