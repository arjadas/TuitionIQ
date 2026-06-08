import { create } from "zustand";
import { type Session, type User } from "@supabase/supabase-js";

/**
 * Single source of truth for the auth lifecycle.
 *
 * `authStatus` is derived from primitives so guards can never observe a
 * half-resolved combination: while `isInitializingAuth` is true the app is
 * still bootstrapping and every guard must render the loading screen.
 */
export type AuthStatus = "initializing" | "unauthenticated" | "unverified" | "authenticated";

type AuthState = {
  session: Session | null;
  user: User | null;
  emailVerified: boolean;
  /**
   * Set after a session-less `signUp()` (Supabase "Confirm email" is ON, so no
   * session is issued yet) or after a login that returns "Email not confirmed".
   * It makes the user `unverified` so the guards route them to verify-email
   * before any session exists. Cleared once verification completes or on sign-out.
   */
  pendingVerificationEmail: string | null;
  isInitializingAuth: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setEmailVerified: (value: boolean) => void;
  setPendingVerificationEmail: (email: string | null) => void;
  setInitializingAuth: (value: boolean) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  emailVerified: false,
  pendingVerificationEmail: null,
  isInitializingAuth: true,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setEmailVerified: (value) => {
    if (__DEV__) console.log("[TEMP store] setEmailVerified", value); // TEMP: remove after verification
    set({ emailVerified: value });
  },
  setPendingVerificationEmail: (email) => {
    if (__DEV__) console.log("[TEMP store] setPendingVerificationEmail", email); // TEMP: remove after verification
    set({ pendingVerificationEmail: email });
  },
  setInitializingAuth: (value) => set({ isInitializingAuth: value }),
  clearAuth: () =>
    set({
      session: null,
      user: null,
      emailVerified: false,
      pendingVerificationEmail: null,
    }),
}));

export function selectAuthStatus(state: AuthState): AuthStatus {
  if (state.isInitializingAuth) {
    return "initializing";
  }

  // A real session is the strongest signal: verified -> authenticated, else unverified.
  if (state.session) {
    return state.emailVerified ? "authenticated" : "unverified";
  }

  // No session yet, but a signup/login left a verification pending -> route to
  // verify-email (session-less signup-confirmation flow).
  if (state.pendingVerificationEmail) {
    return "unverified";
  }

  return "unauthenticated";
}

export const selectIsInitializingAuth = (state: AuthState): boolean => state.isInitializingAuth;
export const selectIsAuthenticated = (state: AuthState): boolean => Boolean(state.session);
export const selectIsEmailVerified = (state: AuthState): boolean => state.emailVerified;

/** Convenience hook: subscribe to the derived auth status. */
export const useAuthStatus = (): AuthStatus => useAuthStore(selectAuthStatus);
