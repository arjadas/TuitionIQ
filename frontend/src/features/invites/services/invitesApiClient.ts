import { apiClient } from "@/src/lib/apiClient";

type AcceptInviteResponse = {
  organizationId?: string | null;
};

async function acceptInvite(token: string): Promise<AcceptInviteResponse> {
  const { data } = await apiClient.post<AcceptInviteResponse>("/api/invites/accept", {
    token,
  });

  return data;
}

export const invitesApiClient = {
  acceptInvite,
};
