import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreateStudentRequest,
  PagedResultOfStudentSummaryDto,
  StudentDto,
  UpdateStudentRequest,
} from "@tuitioniq/types";
import { useMemo } from "react";
import { studentsApiClient } from "@/src/features/students/services/studentsApiClient";

export type StudentsStatusFilter = "all" | "Active" | "Inactive" | "Graduated";

export type StudentsFilters = {
  search?: string;
  status?: StudentsStatusFilter;
  pageSize?: number;
};

type NormalizedStudentsFilters = {
  search: string;
  status: StudentsStatusFilter;
  pageSize: number;
};

type UpdateStudentMutationVariables = {
  studentId: string;
  body: UpdateStudentRequest;
};

type DeleteStudentMutationVariables = {
  studentId: string;
};

function normalizeFilters(filters: StudentsFilters | undefined): NormalizedStudentsFilters {
  return {
    search: (filters?.search ?? "").trim(),
    status: filters?.status ?? "all",
    pageSize: filters?.pageSize ?? 20,
  };
}

export const studentsQueryKey = (orgId: string | null, filters: NormalizedStudentsFilters) =>
  ["students", orgId, filters] as const;

export const studentsOrgQueryKey = (orgId: string | null) => ["students", orgId] as const;

export function useStudents(orgId: string | null, filters?: StudentsFilters) {
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  return useInfiniteQuery<
    PagedResultOfStudentSummaryDto,
    Error,
    InfiniteData<PagedResultOfStudentSummaryDto>,
    ReturnType<typeof studentsQueryKey>,
    number
  >({
    queryKey: studentsQueryKey(orgId, normalizedFilters),
    enabled: Boolean(orgId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const requestStatus = normalizedFilters.status === "all" ? undefined : normalizedFilters.status;

      return studentsApiClient.getStudents(orgId!, {
        page: pageParam,
        pageSize: normalizedFilters.pageSize,
        search: normalizedFilters.search.length > 0 ? normalizedFilters.search : undefined,
        status: requestStatus,
      });
    },
    getNextPageParam: (lastPage) => {
      const loadedItemCount = lastPage.page * lastPage.pageSize;
      if (loadedItemCount >= lastPage.totalCount) {
        return undefined;
      }

      return lastPage.page + 1;
    },
  });
}

export function useCreateStudent(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateStudentRequest): Promise<StudentDto> => {
      if (!orgId) {
        throw new Error("No organization selected.");
      }

      return studentsApiClient.createStudent(orgId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: studentsOrgQueryKey(orgId) });
    },
  });
}

export function useUpdateStudent(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, body }: UpdateStudentMutationVariables): Promise<StudentDto> => {
      if (!orgId) {
        throw new Error("No organization selected.");
      }

      return studentsApiClient.updateStudent(orgId, studentId, body);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: studentsOrgQueryKey(orgId) });
      await queryClient.invalidateQueries({ queryKey: ["student", orgId, variables.studentId] });
    },
  });
}

export function useDeleteStudent(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId }: DeleteStudentMutationVariables): Promise<void> => {
      if (!orgId) {
        throw new Error("No organization selected.");
      }

      await studentsApiClient.deleteStudent(orgId, studentId);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: studentsOrgQueryKey(orgId) });
      await queryClient.removeQueries({ queryKey: ["student", orgId, variables.studentId] });
    },
  });
}
