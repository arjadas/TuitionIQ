import { create } from "zustand";

// App-shell chrome state. `drawerOpen` drives the mobile slide-over; `sidebarCollapsed`
// drives the wide-screen persistent sidebar's icon-only mode.
type UiState = {
  drawerOpen: boolean;
  sidebarCollapsed: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleSidebarCollapsed: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: false,
  sidebarCollapsed: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
