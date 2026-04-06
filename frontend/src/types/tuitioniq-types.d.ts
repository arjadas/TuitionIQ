declare module "@tuitioniq/types" {
  export type UserProfileDto = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    avatarUrl?: string | null;
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

  export type OrganizationMembershipDto = MembershipDto;
}
