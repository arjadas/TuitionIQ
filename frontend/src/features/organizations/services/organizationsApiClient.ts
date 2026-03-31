import type { OrganizationMembershipDto } from "@tuitioniq/types";
import { apiClient } from "@/src/lib/apiClient";

async function getMyMemberships(): Promise<OrganizationMembershipDto[]> {
  const { data } = await apiClient.get<OrganizationMembershipDto[]>("/api/organizations/memberships");
  return data;
}

export const organizationsApiClient = {
  getMyMemberships,
};
