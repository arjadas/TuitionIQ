import { create } from "zustand";

export type OrgMembership = {
  organizationId: string;
  role: string;
  name?: string;
  slug?: string;
};

type OrgState = {
  memberships: OrgMembership[];
  selectedOrgId: string | null;
  setMemberships: (memberships: OrgMembership[]) => void;
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
