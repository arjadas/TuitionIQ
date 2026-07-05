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
  isInitializingAuth: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  /**
   * Publish session, user and the resolved email_verified flag in a single
   * atomic update. Used by the auth bootstrap so guards transition straight to
   * `authenticated`/`unverified` without observing a half-resolved pair.
   */
  setResolvedSession: (session: Session, emailVerified: boolean) => void;
  setEmailVerified: (value: boolean) => void;
  setInitializingAuth: (value: boolean) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  emailVerified: false,
  isInitializingAuth: true,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setResolvedSession: (session, emailVerified) => set({ session, user: session.user, emailVerified }),
  setEmailVerified: (value) => set({ emailVerified: value }),
  setInitializingAuth: (value) => set({ isInitializingAuth: value }),
  clearAuth: () =>
    set({
      session: null,
      user: null,
      emailVerified: false,
    }),
}));

export function selectAuthStatus(state: AuthState): AuthStatus {
  if (state.isInitializingAuth) {
    return "initializing";
  }

  // The session is the single source of truth. Both signUp() and
  // signInWithPassword() establish one (Supabase "Confirm email" is OFF), so
  // there is no session-less limbo: verified -> authenticated, otherwise the
  // app-level OTP gate routes the user to verify-email.
  if (state.session) {
    return state.emailVerified ? "authenticated" : "unverified";
  }

  return "unauthenticated";
}

export const selectIsInitializingAuth = (state: AuthState): boolean => state.isInitializingAuth;
export const selectIsAuthenticated = (state: AuthState): boolean => Boolean(state.session);
export const selectIsEmailVerified = (state: AuthState): boolean => state.emailVerified;

/** Convenience hook: subscribe to the derived auth status. */
export const useAuthStatus = (): AuthStatus => useAuthStore(selectAuthStatus);
