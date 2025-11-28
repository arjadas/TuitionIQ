import { apiClient } from './client';
import { ENDPOINTS } from '@/constants/config';
import type { Student, CreateStudentDto, UpdateStudentDto } from '@/types';

export const studentsApi = {
  getAll: () => apiClient.get<Student[]>(ENDPOINTS.STUDENTS),
  
  getById: (id: number) => apiClient.get<Student>(`${ENDPOINTS.STUDENTS}/${id}`),
  
  create: (data: CreateStudentDto) => apiClient.post<Student>(ENDPOINTS.STUDENTS, data),
  
  update: (id: number, data: UpdateStudentDto) => 
    apiClient.put<void>(`${ENDPOINTS.STUDENTS}/${id}`, data),
  
  delete: (id: number) => apiClient.delete<void>(`${ENDPOINTS.STUDENTS}/${id}`),
};