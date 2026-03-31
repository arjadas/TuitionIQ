import { ENDPOINTS } from '@/constants/config';
import { apiClient } from '@/services/api/client';
import type { CreateStudentDto, Student, UpdateStudentDto } from '@/types';

interface StudentResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentDate: string;
}

const transformStudent = (student: StudentResponse): Student => ({
  ...student,
  enrollmentDate: new Date(student.enrollmentDate),
});

export const studentsApi = {
  getAll: async () => {
    const students = await apiClient.get<StudentResponse[]>(ENDPOINTS.STUDENTS);
    return students.map(transformStudent);
  },

  getById: async (id: number) => {
    const student = await apiClient.get<StudentResponse>(`${ENDPOINTS.STUDENTS}/${id}`);
    return transformStudent(student);
  },

  create: async (data: CreateStudentDto) => {
    const student = await apiClient.post<StudentResponse>(ENDPOINTS.STUDENTS, data);
    return transformStudent(student);
  },

  update: (id: number, data: UpdateStudentDto) =>
    apiClient.put<void>(`${ENDPOINTS.STUDENTS}/${id}`, data),

  delete: (id: number) => apiClient.delete<void>(`${ENDPOINTS.STUDENTS}/${id}`),
};
