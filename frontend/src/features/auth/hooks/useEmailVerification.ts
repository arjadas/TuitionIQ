import { AxiosError } from "axios";
import { authService } from "@/src/features/auth/services/authService";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";
import { useAuthStore } from "@/src/store/authStore";

type ApiErrorResponse = {
  code?: string;
};

function isEmailNotVerifiedResponse(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const code = (error.response?.data as ApiErrorResponse | undefined)?.code;
  return error.response?.status === 403 && code === "EMAIL_NOT_VERIFIED";
}

function getSessionEmail(email: string | null | undefined): string {
  if (!email) {
    throw new Error("You are not signed in.");
  }

  return email.trim().toLowerCase();
}

export function useEmailVerification() {
  const sessionEmail = useAuthStore((state) => state.session?.user?.email);
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);

  const getActiveSessionEmail = async (): Promise<string> => {
    const {
      data: { session },
      error,
    } = await authService.getSession();

    if (error) {
      throw new Error(error.message || "Could not load your session.");
    }

    return getSessionEmail(session?.user?.email ?? sessionEmail);
  };

  const refreshEmailVerificationStatus = async (): Promise<boolean> => {
    const {
      data: { session },
      error,
    } = await authService.getSession();

    if (error) {
      throw new Error(error.message || "Could not refresh your session.");
    }

    if (!session) {
      setEmailVerified(false);
      return false;
    }

    try {
      const profile = await usersApiClient.getCurrentUserProfile();
      setEmailVerified(profile.emailVerified);
      return profile.emailVerified;
    } catch (error) {
      if (isEmailNotVerifiedResponse(error)) {
        setEmailVerified(false);
        return false;
      }

      throw error;
    }
  };

  const sendVerificationOtp = async (): Promise<void> => {
    const email = await getActiveSessionEmail();
    const { error } = await authService.sendVerificationOtp(email);

    if (error) {
      throw new Error(error.message || "Could not send the verification code.");
    }
  };

  const verifyEmailOtp = async (otpCode: string): Promise<void> => {
    const email = await getActiveSessionEmail();
    const token = otpCode.trim();

    if (token.length !== 6) {
      throw new Error("Enter the 6-digit verification code.");
    }

    const { error: otpError } = await authService.verifyEmailOtp(email, token);
    if (otpError) {
      throw new Error(otpError.message || "The code is invalid or expired.");
    }

    const { error: refreshError } = await authService.getSession();
    if (refreshError) {
      throw new Error(refreshError.message || "Could not refresh your session.");
    }

    const isAlreadyVerified = await refreshEmailVerificationStatus();
    if (!isAlreadyVerified) {
      await usersApiClient.markEmailVerified();
    }

    setEmailVerified(true);
  };

  return {
    refreshEmailVerificationStatus,
    sendVerificationOtp,
    verifyEmailOtp,
  };
}
