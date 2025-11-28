import React from 'react';
import { Edit, Trash2, ChevronRight } from 'lucide-react';
import type { Student } from '@/types';

interface StudentCardProps {
  student: Student;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
  onClick: (student: Student) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onEdit, onDelete, onClick }) => {
  const handleCardClick = () => {
    onClick(student);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onEdit(student);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onDelete(student.id);
  };

  return (
    <div 
      className="bg-gray-50 rounded-lg p-4 border cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
      onClick={handleCardClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="font-semibold text-lg">{"ID :"} {student.id}</h2>
          <h4 className="font-semibold text-lg">{"Name :"} {student.firstName} {student.lastName}</h4>
          <p className="text-base text-gray-600">{"Email :"} {student.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEditClick}
            className="text-blue-600 hover:text-blue-800 transition-colors p-1 hover:bg-blue-100 rounded"
            title="Edit student"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={handleDeleteClick}
            className="text-red-600 hover:text-red-800 transition-colors p-1 hover:bg-red-100 rounded"
            title="Delete student"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-end text-blue-600 text-sm">
        <span>View details</span>
        <ChevronRight size={16} />
      </div>
    </div>
  );
};