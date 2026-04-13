import type { UpdateProfileRequest, UserProfileDto } from "@tuitioniq/types";
import { apiClient } from "@/src/lib/apiClient";

async function getCurrentUserProfile(): Promise<UserProfileDto> {
  const { data } = await apiClient.get<UserProfileDto>("/api/users/me");
  return data;
}

async function updateProfile(request: UpdateProfileRequest): Promise<UserProfileDto> {
  const { data } = await apiClient.patch<UserProfileDto>("/api/users/profile", request);
  return data;
}

async function markEmailVerified(): Promise<void> {
  await apiClient.patch("/api/users/email-verification", {});
}

export const usersApiClient = {
  getCurrentUserProfile,
  updateProfile,
  markEmailVerified,
};
