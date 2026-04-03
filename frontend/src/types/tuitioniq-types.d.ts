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

  export type OrganizationMembershipDto = {
    organizationId: string;
    role: string;
    organization: {
      id: string;
      name: string;
      slug: string;
      plan: string;
    };
  };
}
