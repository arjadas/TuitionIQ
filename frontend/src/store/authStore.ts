import { create } from "zustand";
import { type Session, type User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  emailVerified: boolean;
  isInitialised: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setEmailVerified: (value: boolean) => void;
  setInitialised: (value: boolean) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  emailVerified: false,
  isInitialised: false,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setEmailVerified: (value) => set({ emailVerified: value }),
  setInitialised: (value) => set({ isInitialised: value }),
  clearAuth: () =>
    set({
      session: null,
      user: null,
      emailVerified: false,
    }),
}));
