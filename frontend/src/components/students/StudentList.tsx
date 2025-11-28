import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { StudentCard } from './StudentCard';
import { StudentDetailModal } from './StudentDetailModal';
import type { Student } from '@/types';

interface StudentListProps {
  students: Student[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

export const StudentList: React.FC<StudentListProps> = ({
  students,
  searchTerm,
  onSearchChange,
  onEdit,
  onDelete,
}) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleCardClick = (student: Student) => {
    setSelectedStudent(student);
  };

  const handleCloseModal = () => {
    setSelectedStudent(null);
  };

  const handleEditFromModal = (student: Student) => {
    setSelectedStudent(null);
    onEdit(student);
  };

  const handleDeleteFromModal = (id: number) => {
    setSelectedStudent(null);
    onDelete(id);
  };

  return (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((student) => (
          <StudentCard
            key={student.id}
            student={student}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={handleCardClick}
          />
        ))}
      </div>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={handleCloseModal}
          onEdit={handleEditFromModal}
          onDelete={handleDeleteFromModal}
        />
      )}
    </div>
  );
};