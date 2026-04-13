import { supabase } from "@/src/lib/supabase";

type SignUpInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type VerifyEmailOtpInput = {
  email: string;
  token: string;
};

export async function signUp(input: SignUpInput)
{
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

export async function signInWithPassword(input: SignInInput)
{
  return supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
}

export async function signOut()
{
  return supabase.auth.signOut();
}

export async function signOutGlobal()
{
  return supabase.auth.signOut({ scope: "global" });
}

export async function resetPasswordForEmail(email: string, redirectUrl: string)
{
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
}

export async function updatePassword(newPassword: string)
{
  return supabase.auth.updateUser({ password: newPassword });
}

export async function sendVerificationOtp(email: string)
{
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });
}

export async function verifyEmailOtp(input: VerifyEmailOtpInput)
{
  return supabase.auth.verifyOtp({
    email: input.email,
    token: input.token,
    type: "email",
  });
}

export const authService = {
  signUp,
  signInWithPassword,
  signOut,
  signOutGlobal,
  resetPasswordForEmail,
  updatePassword,
  sendVerificationOtp,
  verifyEmailOtp,
};
