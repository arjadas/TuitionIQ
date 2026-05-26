import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { Platform } from "react-native";
import type { MembershipDto } from "@tuitioniq/types";

type OrgState = {
  memberships: MembershipDto[];
  selectedOrgId: string | null;
  setMemberships: (memberships: MembershipDto[]) => void;
  selectOrg: (organizationId: string | null) => void;
  clearOrg: () => void;
};

type BrowserStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const browserSessionStorage = (globalThis as { sessionStorage?: BrowserStorage }).sessionStorage;
const isBrowserWeb = Platform.OS === "web" && !!browserSessionStorage;

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

// Per authentication.md §11: org context persists in sessionStorage on web
// (survives refresh, clears on tab close) and stays in-memory only on native.
const orgContextStorage: StateStorage = isBrowserWeb
  ? {
      getItem: (key) => browserSessionStorage?.getItem(key) ?? null,
      setItem: (key, value) => browserSessionStorage?.setItem(key, value),
      removeItem: (key) => browserSessionStorage?.removeItem(key),
    }
  : noopStorage;

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      memberships: [],
      selectedOrgId: null,
      setMemberships: (memberships) => set({ memberships }),
      selectOrg: (organizationId) => set({ selectedOrgId: organizationId }),
      clearOrg: () =>
        set({
          memberships: [],
          selectedOrgId: null,
        }),
    }),
    {
      name: "tuitioniq-org-context",
      storage: createJSONStorage(() => orgContextStorage),
      // Only the selected org id is durable; memberships are always refetched.
      partialize: (state) => ({ selectedOrgId: state.selectedOrgId }),
    },
  ),
);
