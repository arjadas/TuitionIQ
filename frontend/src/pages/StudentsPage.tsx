import React, { useState } from 'react';
import { StudentList } from '@/components/students/StudentList';
import { StudentForm } from '@/components/students/StudentForm';
import type { Student, CreateStudentDto, UpdateStudentDto } from '@/types';

interface StudentsPageProps {
  students: Student[];
  onCreateStudent: (data: CreateStudentDto) => Promise<boolean>;
  onUpdateStudent: (id: number, data: UpdateStudentDto) => Promise<boolean>;
  onDeleteStudent: (id: number) => Promise<boolean>;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  students,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | undefined>();

  const filteredStudents = students.filter(
    (s) =>
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      await onDeleteStudent(id);
    }
  };

  const handleSubmit = async (data: CreateStudentDto) => {
    if (editingStudent) {
      const updateData: UpdateStudentDto = {
        ...data,
        enrollmentDate: editingStudent.enrollmentDate,
      };
      return await onUpdateStudent(editingStudent.id, updateData);
    } else {
      return await onCreateStudent(data);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingStudent(undefined);
  };

  return (
    <>
      <StudentList
        students={filteredStudents}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showForm && (
        <StudentForm student={editingStudent} onClose={handleCloseForm} onSubmit={handleSubmit} />
      )}
    </>
  );
};
