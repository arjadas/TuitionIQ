import { useQueryClient } from "@tanstack/react-query";
import type { OrganizationMembershipDto, UserProfileDto } from "@tuitioniq/types";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useOrgMemberships } from "@/src/features/organizations/hooks/useOrgMemberships";
import { useCurrentUser, usersMeQueryKey } from "@/src/features/users/hooks/useCurrentUser";
import { useOrgStore } from "@/src/store/orgStore";

type HomeScreenState = {
  currentUser: UserProfileDto | null;
  memberships: OrganizationMembershipDto[];
  isLoading: boolean;
  shouldShowProfileCompletion: boolean;
  shouldShowWelcome: boolean;
  shouldShowOrgSelector: boolean;
  errorMessage: string | null;
  onProfileCompleted: (profile: UserProfileDto) => void;
  onSelectOrg: (membership: OrganizationMembershipDto) => void;
  onCreateOrganization: () => void;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function useHomeScreenState(): HomeScreenState {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectOrg = useOrgStore((state) => state.selectOrg);

  const userQuery = useCurrentUser();

  const isProfileIncomplete = useMemo(() => {
    const profile = userQuery.data;
    if (!profile) {
      return false;
    }

    return profile.firstName.trim().length === 0 || profile.lastName.trim().length === 0;
  }, [userQuery.data]);

  const membershipsQuery = useOrgMemberships({
    enabled: userQuery.isSuccess && !isProfileIncomplete,
  });

  const memberships = useMemo(() => membershipsQuery.data ?? [], [membershipsQuery.data]);
  const hasRedirectedToDashboard = useRef(false);

  useEffect(() => {
    if (hasRedirectedToDashboard.current) {
      return;
    }

    if (!membershipsQuery.isSuccess || memberships.length !== 1) {
      return;
    }

    const onlyMembership = memberships[0];
    selectOrg(onlyMembership.organizationId);
    hasRedirectedToDashboard.current = true;
    router.replace("/dashboard" as Href);
  }, [memberships, membershipsQuery.isSuccess, router, selectOrg]);

  const onProfileCompleted = useCallback(
    (profile: UserProfileDto) => {
      queryClient.setQueryData(usersMeQueryKey, profile);
    },
    [queryClient],
  );

  const onSelectOrg = useCallback(
    (membership: OrganizationMembershipDto) => {
      selectOrg(membership.organizationId);
      router.replace("/dashboard" as Href);
    },
    [router, selectOrg],
  );

  const onCreateOrganization = useCallback(() => {
    router.push("/organizations/create" as Href);
  }, [router]);

  const isLoading =
    userQuery.isPending || (!isProfileIncomplete && membershipsQuery.isPending && !hasRedirectedToDashboard.current);

  const errorMessage = userQuery.isError
    ? getErrorMessage(userQuery.error)
    : membershipsQuery.isError
      ? getErrorMessage(membershipsQuery.error)
      : null;

  return {
    currentUser: userQuery.data ?? null,
    memberships,
    isLoading,
    shouldShowProfileCompletion: isProfileIncomplete,
    shouldShowWelcome: membershipsQuery.isSuccess && memberships.length === 0,
    shouldShowOrgSelector: membershipsQuery.isSuccess && memberships.length > 1,
    errorMessage,
    onProfileCompleted,
    onSelectOrg,
    onCreateOrganization,
  };
}
