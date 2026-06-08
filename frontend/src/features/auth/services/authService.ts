import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { supabase } from "@/src/lib/supabase";

type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

function getResetPasswordRedirectTo(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }

  return Linking.createURL("/reset-password");
}

async function signUp(input: SignUpInput) {
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
      },
    },
  });
}

async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

async function signOut() {
  return supabase.auth.signOut();
}

async function signOutEverywhere() {
  return supabase.auth.signOut({ scope: "global" });
}

async function resetPasswordForEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getResetPasswordRedirectTo(),
  });
}

async function exchangeCodeForSession(code: string) {
  return supabase.auth.exchangeCodeForSession(code);
}

async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

async function sendVerificationOtp(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });
}

async function verifyEmailOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
}

// Confirm a brand-new signup with its 6-digit code. Works without a prior
// session and establishes one on success.
async function verifySignupOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
}

// Re-send the signup confirmation code (session-less).
async function resendSignupOtp(email: string) {
  return supabase.auth.resend({
    type: "signup",
    email,
  });
}

async function getSession() {
  return supabase.auth.getSession();
}

export const authService = {
  signUp,
  signInWithPassword,
  signOut,
  signOutEverywhere,
  resetPasswordForEmail,
  exchangeCodeForSession,
  updatePassword,
  sendVerificationOtp,
  verifyEmailOtp,
  verifySignupOtp,
  resendSignupOtp,
  getSession,
};
