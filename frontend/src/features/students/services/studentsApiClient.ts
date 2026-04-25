import type {
  CreateStudentRequest,
  PagedResultOfStudentSummaryDto,
  StudentDto,
  UpdateStudentRequest,
} from "@tuitioniq/types";
import { apiClient } from "@/src/lib/apiClient";

export type GetStudentsParams = {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

async function getStudents(
  orgId: string,
  params: GetStudentsParams,
): Promise<PagedResultOfStudentSummaryDto> {
  const { data } = await apiClient.get<PagedResultOfStudentSummaryDto>(
    `/api/organizations/${orgId}/students`,
    {
      params,
    },
  );

  return data;
}

async function getStudent(orgId: string, studentId: string): Promise<StudentDto> {
  const { data } = await apiClient.get<StudentDto>(`/api/organizations/${orgId}/students/${studentId}`);
  return data;
}

async function createStudent(orgId: string, body: CreateStudentRequest): Promise<StudentDto> {
  const { data } = await apiClient.post<StudentDto>(`/api/organizations/${orgId}/students`, body);
  return data;
}

async function updateStudent(
  orgId: string,
  studentId: string,
  body: UpdateStudentRequest,
): Promise<StudentDto> {
  const { data } = await apiClient.patch<StudentDto>(
    `/api/organizations/${orgId}/students/${studentId}`,
    body,
  );

  return data;
}

async function deleteStudent(orgId: string, studentId: string): Promise<void> {
  await apiClient.delete(`/api/organizations/${orgId}/students/${studentId}`);
}

export const studentsApiClient = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
};
