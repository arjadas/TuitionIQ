import { useState, useEffect, useCallback } from 'react';
import { studentsApi } from '@/api/students.api';
import type { Student, CreateStudentDto, UpdateStudentDto } from '@/types';

/**
 * Custom hook for managing student data with CRUD operations.
 * 
 * Provides:
 * - `students`: Array of all students
 * - `loading`: Boolean indicating if data is being fetched
 * - `error`: Error message if an operation failed
 * - `fetchStudents`: Function to refresh the student list
 * - `createStudent`: Function to create a new student
 * - `updateStudent`: Function to update an existing student
 * - `deleteStudent`: Function to delete a student
 * 
 * @returns Student state and CRUD operations
 * 
 * @example
 * ```tsx
 * const { students, loading, createStudent } = useStudents();
 * 
 * if (loading) return <Spinner />;
 * 
 * return students.map(s => <StudentCard key={s.id} student={s} />);
 * ```
 */
export const useStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentsApi.getAll();
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch students');
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const createStudent = async (data: CreateStudentDto): Promise<boolean> => {
    try {
      await studentsApi.create(data);
      await fetchStudents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create student');
      return false;
    }
  };

  const updateStudent = async (id: number, data: UpdateStudentDto): Promise<boolean> => {
    try {
      await studentsApi.update(id, data);
      await fetchStudents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update student');
      return false;
    }
  };

  const deleteStudent = async (id: number): Promise<boolean> => {
    try {
      await studentsApi.delete(id);
      await fetchStudents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
      return false;
    }
  };

  return {
    students,
    loading,
    error,
    fetchStudents,
    createStudent,
    updateStudent,
    deleteStudent,
  };
};
