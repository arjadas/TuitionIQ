import React, { useState } from 'react';
import type { Student, CreatePaymentRecordDto } from '@/types';
import { CURRENT_YEAR, CURRENT_MONTH, MONTHS } from '@/constants/config';

interface PaymentRecordFormProps {
  students: Student[];
  onClose: () => void;
  onSubmit: (data: CreatePaymentRecordDto) => Promise<boolean>;
}

export const PaymentRecordForm: React.FC<PaymentRecordFormProps> = ({ students, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreatePaymentRecordDto>({
    studentId: 0,
    billYear: CURRENT_YEAR,
    billMonth: CURRENT_MONTH,
    amount: 0,
    notes: '',
  });

  const handleSubmit = async () => {
    const success = await onSubmit(formData);
    if (success) {
      onClose();
    }
  };

  const handleStudentChange = (studentId: string) => {
    setFormData({
      ...formData,
      studentId: parseInt(studentId),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Record Payment</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Student</label>
            <select
              required
              value={formData.studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <input
                type="number"
                required
                value={formData.billYear}
                onChange={(e) => setFormData({ ...formData, billYear: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Month</label>
              <select
                required
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
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Create Payment Record
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};