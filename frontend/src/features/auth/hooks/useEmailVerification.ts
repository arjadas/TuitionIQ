import { useEffect, useMemo, useState } from "react";
import { authService } from "@/src/features/auth/services/authService";
import { isApiClientError } from "@/src/lib/apiClient";
import { useAuthStore } from "@/src/store/authStore";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";

const RESEND_COOLDOWN_SECONDS = 60;

function normalizeEmail(email: string | null | undefined): string
{
  if (!email) {
    throw new Error("You must be signed in to verify your email.");
  }

  return email.trim().toLowerCase();
}

export function useEmailVerification()
{
  const session = useAuthStore((state) => state.session);
  const emailVerified = useAuthStore((state) => state.emailVerified);
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);

  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cooldownRemaining = useMemo(() => {
    if (!cooldownEndsAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000));
  }, [cooldownEndsAt, now]);

  const canResend = cooldownRemaining === 0;

  async function refreshEmailVerificationStatus(): Promise<boolean>
  {
    if (!session) {
      setEmailVerified(false);
      return false;
    }

    try {
      const profile = await usersApiClient.getCurrentUserProfile();
      setEmailVerified(profile.emailVerified);
      return profile.emailVerified;
    } catch (error) {
      if (isApiClientError(error) && error.code === "EMAIL_NOT_VERIFIED") {
        setEmailVerified(false);
        return false;
      }

      throw error;
    }
  }

  async function sendOtp(): Promise<void>
  {
    if (!canResend) {
      return;
    }

    const email = normalizeEmail(session?.user?.email);
    const { error } = await authService.sendVerificationOtp(email);
    if (error) {
      throw new Error(error.message || "Failed to send verification code.");
    }

    setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
  }

  async function verifyOtp(code: string): Promise<void>
  {
    const token = code.trim();
    if (token.length !== 6) {
      throw new Error("Enter the 6-digit verification code.");
    }

    const email = normalizeEmail(session?.user?.email);

    const { error: otpError } = await authService.verifyEmailOtp({ email, token });
    if (otpError) {
      throw new Error(otpError.message || "Invalid verification code.");
    }

    await usersApiClient.markEmailVerified();
    setEmailVerified(true);
  }

  return {
    emailVerified,
    cooldownRemaining,
    canResend,
    refreshEmailVerificationStatus,
    sendOtp,
    verifyOtp,
  };
}
