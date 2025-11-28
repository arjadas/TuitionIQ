import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import type { Student } from '@/types';

interface StudentCardProps {
  student: Student;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onEdit, onDelete }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-lg">{student.firstName}{student.lastName}</h4>
          <p className="text-sm text-gray-600">{student.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(student)}
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => onDelete(student.id)}
            className="text-red-600 hover:text-red-800 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
    </div>
  );
};