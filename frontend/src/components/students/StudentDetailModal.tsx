import { useState, useEffect } from 'react';
import { X, Mail, Calendar, DollarSign, CheckCircle, XCircle, Edit, Trash2 } from 'lucide-react';
import type { Student, PaymentRecord } from '@/types';
import { paymentRecordsApi } from '@/api/paymentRecords.api';
import { formatCurrency } from '@/utils/currency.utils';
import { formatDate } from '@/utils/date.utils';

interface StudentDetailModalProps {
  student: Student;
  onClose: () => void;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

/**
 * Modal component displaying detailed student information and payment history.
 */
export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const allPayments = await paymentRecordsApi.getAll();
        const studentPayments = allPayments.filter(p => p.studentId === student.id);
        setPayments(studentPayments);
      } catch (error) {
        console.error('Failed to fetch payments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [student.id]);

  // Calculate payment statistics
  const totalBilled = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments.filter(p => p.isPaid).reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = totalBilled - totalPaid;
  const overdueCount = payments.filter(p => p.isOverdue).length;

  const handleEdit = () => {
    onEdit(student);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${student.firstName} ${student.lastName}?`)) {
      onDelete(student.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">
                {student.firstName} {student.lastName}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-blue-100">
                <Mail size={16} />
                <span>{student.email}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-blue-100">
                <Calendar size={16} />
                <span>Enrolled: {formatDate(student.enrollmentDate)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                title="Edit student"
              >
                <Edit size={20} />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                title="Delete student"
              >
                <Trash2 size={20} />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 border-b">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Billed</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalBilled)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Overdue</p>
            <p className="text-lg font-bold text-orange-600">{overdueCount} payments</p>
          </div>
        </div>

        {/* Payment History */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-gray-600" />
            Payment History
          </h3>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No payment records found for this student.
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className={`border rounded-lg p-3 ${
                    payment.isOverdue
                      ? 'border-red-300 bg-red-50'
                      : payment.isPaid
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {payment.monthName} {payment.billYear}
                      </p>
                      <p className="text-sm text-gray-600">
                        Due: {formatDate(payment.dueDate)}
                        {payment.paymentDate && (
                          <span className="ml-2 text-green-600">
                            • Paid: {formatDate(payment.paymentDate)}
                          </span>
                        )}
                      </p>
                      {payment.notes && (
                        <p className="text-sm text-gray-500 mt-1 italic">{payment.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(payment.amount)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {payment.isPaid ? (
                          <>
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="text-sm text-green-600">Paid</span>
                          </>
                        ) : payment.isOverdue ? (
                          <>
                            <XCircle size={16} className="text-red-600" />
                            <span className="text-sm text-red-600">Overdue</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-500">Unpaid</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
