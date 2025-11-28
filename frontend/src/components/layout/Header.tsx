import React from 'react';
import { Plus } from 'lucide-react';

interface HeaderProps {
  onAddStudent: () => void;
  onAddPayment: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onAddStudent, onAddPayment }) => {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">TuitionIQ</h1>
          <div className="flex gap-2">
            <button
              onClick={onAddStudent}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Add Student
            </button>
            <button
              onClick={onAddPayment}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={20} />
              Record Payment
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};