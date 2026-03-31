import { create } from "zustand";
import type { OrganizationMembershipDto } from "@tuitioniq/types";

type OrgState = {
  memberships: OrganizationMembershipDto[];
  selectedOrgId: string | null;
  setMemberships: (memberships: OrganizationMembershipDto[]) => void;
  selectOrg: (organizationId: string | null) => void;
  clearOrg: () => void;
};

export const useOrgStore = create<OrgState>((set) => ({
  memberships: [],
  selectedOrgId: null,
  setMemberships: (memberships) => set({ memberships }),
  selectOrg: (organizationId) => set({ selectedOrgId: organizationId }),
  clearOrg: () =>
    set({
      memberships: [],
      selectedOrgId: null,
    }),
}));
