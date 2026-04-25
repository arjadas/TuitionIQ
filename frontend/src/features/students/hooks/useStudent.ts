import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { StudentDto } from "@tuitioniq/types";
import { studentsApiClient } from "@/src/features/students/services/studentsApiClient";

export const studentQueryKey = (orgId: string | null, studentId: string | null) =>
  ["student", orgId, studentId] as const;

export function useStudent(orgId: string | null, studentId: string | null): UseQueryResult<StudentDto> {
  return useQuery<StudentDto>({
    queryKey: studentQueryKey(orgId, studentId),
    enabled: Boolean(orgId && studentId),
    queryFn: () => studentsApiClient.getStudent(orgId!, studentId!),
  });
}
