declare module "@tuitioniq/types" {
  export type UserProfileDto = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    emailVerified: boolean;
  };

  export type UpdateProfileRequest = {
    firstName: string;
    lastName: string;
    phone?: string | null;
  };

  export type OrganizationDto = {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
  };

  export type MembershipDto = {
    organizationId: string;
    role: string;
    joinedAt?: string | null;
    organization: OrganizationDto;
  };

  export type CreateOrganizationRequest = {
    name: string;
    slug: string;
  };

  export type UpdateOrganizationRequest = {
    name?: string | null;
    settings?: unknown;
  };

  export type StudentDto = {
    id: string;
    organizationId: string;
    userId?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    status: string;
    accountStatus: string;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
  };

  export type StudentSummaryDto = {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    status: string;
    accountStatus: string;
    createdAt: string;
  };

  export type CreateStudentRequest = {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  };

  export type UpdateStudentRequest = {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  };

  export type PagedResultOfStudentSummaryDto = {
    items: StudentSummaryDto[];
    page: number;
    pageSize: number;
    totalCount: number;
  };

  export type OrganizationMembershipDto = MembershipDto;
}
