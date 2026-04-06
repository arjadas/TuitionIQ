import type {
  CreateOrganizationRequest,
  MembershipDto,
  OrganizationDto,
  UpdateOrganizationRequest,
} from "@tuitioniq/types";
import { apiClient } from "@/src/lib/apiClient";

async function createOrg(body: CreateOrganizationRequest): Promise<OrganizationDto> {
  const { data } = await apiClient.post<OrganizationDto>("/api/organizations", body);
  return data;
}

async function getOrg(id: string): Promise<OrganizationDto> {
  const { data } = await apiClient.get<OrganizationDto>(`/api/organizations/${id}`);
  return data;
}

async function updateOrg(id: string, body: UpdateOrganizationRequest): Promise<OrganizationDto> {
  const { data } = await apiClient.patch<OrganizationDto>(`/api/organizations/${id}`, body);
  return data;
}

async function getMyMemberships(): Promise<MembershipDto[]> {
  const { data } = await apiClient.get<MembershipDto[]>("/api/organizations/memberships");
  return data;
}

export const organizationsApiClient = {
  createOrg,
  getOrg,
  updateOrg,
  getMyMemberships,
};
