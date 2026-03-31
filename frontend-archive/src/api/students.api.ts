import { apiClient } from './client';
import { ENDPOINTS } from '@/constants/config';
import type { Student, CreateStudentDto, UpdateStudentDto } from '@/types';

// Backend response type (before transformation)
interface StudentResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentDate: string; // Backend returns ISO string
}

/**
 * Transforms backend response to frontend Student with proper Date objects.
 */
const transformStudent = (student: StudentResponse): Student => ({
  ...student,
  enrollmentDate: new Date(student.enrollmentDate),
});

export const studentsApi = {
  /**
   * Fetches all students.
   */
  getAll: async () => {
    const students = await apiClient.get<StudentResponse[]>(ENDPOINTS.STUDENTS);
    return students.map(transformStudent);
  },

  /**
   * Fetches a single student by ID.
   */
  getById: async (id: number) => {
    const student = await apiClient.get<StudentResponse>(`${ENDPOINTS.STUDENTS}/${id}`);
    return transformStudent(student);
  },

  /**
   * Creates a new student.
   */
  create: async (data: CreateStudentDto) => {
    const student = await apiClient.post<StudentResponse>(ENDPOINTS.STUDENTS, data);
    return transformStudent(student);
  },

  /**
   * Updates an existing student.
   */
  update: (id: number, data: UpdateStudentDto) =>
    apiClient.put<void>(`${ENDPOINTS.STUDENTS}/${id}`, data),

  /**
   * Deletes a student.
   */
  delete: (id: number) => apiClient.delete<void>(`${ENDPOINTS.STUDENTS}/${id}`),
};