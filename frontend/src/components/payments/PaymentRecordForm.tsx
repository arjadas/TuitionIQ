import React, { useState } from 'react';
import type { Student, CreatePaymentRecordDto } from '@/types';
import { CURRENT_YEAR, CURRENT_MONTH, MONTHS } from '@/constants/config';

interface PaymentRecordFormProps {
  students: Student[];
  onClose: () => void;
  onSubmit: (data: CreatePaymentRecordDto) => Promise<boolean>;
}

interface FormErrors {
  studentId?: string;
  billYear?: string;
  amount?: string;
  notes?: string;
}

/**
 * Form component for creating a payment record.
 */
export const PaymentRecordForm: React.FC<PaymentRecordFormProps> = ({ students, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreatePaymentRecordDto>({
    studentId: 0,
    billYear: CURRENT_YEAR,
    billMonth: CURRENT_MONTH,
    amount: 0,
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validates form data and returns true if valid.
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.studentId || formData.studentId === 0) {
      newErrors.studentId = 'Please select a student';
    }

    if (formData.billYear < 2020 || formData.billYear > 2100) {
      newErrors.billYear = 'Year must be between 2020 and 2100';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (formData.amount > 10000) {
      newErrors.amount = 'Amount cannot exceed $10,000';
    }

    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = 'Notes must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        ...formData,
        notes: formData.notes?.trim() || undefined,
      });
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentChange = (studentId: string) => {
    setFormData({
      ...formData,
      studentId: parseInt(studentId) || 0,
    });
    if (errors.studentId) setErrors({ ...errors, studentId: undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Record Payment</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Student</label>
            <select
              value={formData.studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.studentId ? 'border-red-500' : ''
              }`}
            >
              <option value="0">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName}
                </option>
              ))}
            </select>
            {errors.studentId && (
              <p className="text-red-500 text-sm mt-1">{errors.studentId}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <input
                type="number"
                value={formData.billYear}
                onChange={(e) => {
                  setFormData({ ...formData, billYear: parseInt(e.target.value) || CURRENT_YEAR });
                  if (errors.billYear) setErrors({ ...errors, billYear: undefined });
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.billYear ? 'border-red-500' : ''
                }`}
              />
              {errors.billYear && (
                <p className="text-red-500 text-sm mt-1">{errors.billYear}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Month</label>
              <select
                value={formData.billMonth}
                onChange={(e) => setFormData({ ...formData, billMonth: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MONTHS.map((month, index) => (
                  <option key={index + 1} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="10000"
              value={formData.amount || ''}
              onChange={(e) => {
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 });
                if (errors.amount) setErrors({ ...errors, amount: undefined });
              }}
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.amount ? 'border-red-500' : ''
              }`}
            />
            {errors.amount && (
              <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => {
                setFormData({ ...formData, notes: e.target.value });
                if (errors.notes) setErrors({ ...errors, notes: undefined });
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.notes ? 'border-red-500' : ''
              }`}
              rows={3}
              maxLength={500}
            />
            {errors.notes && (
              <p className="text-red-500 text-sm mt-1">{errors.notes}</p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Payment Record'}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};