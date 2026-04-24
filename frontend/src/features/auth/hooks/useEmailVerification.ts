import { AxiosError } from "axios";
import { authService } from "@/src/features/auth/services/authService";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";
import { getApiErrorCode, getApiErrorMessage as getParsedApiErrorMessage } from "@/src/shared/utils/apiError";
import { useAuthStore } from "@/src/store/authStore";

function debugAuthVerification(message: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (payload === undefined) {
    console.log("[auth/verification]", message);
    return;
  }

  console.log("[auth/verification]", message, payload);
}

function isEmailNotVerifiedResponse(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const code = getApiErrorCode(error);
  if (error.response?.status !== 403) {
    return false;
  }

  if (code === "EMAIL_NOT_VERIFIED") {
    return true;
  }

  if (code) {
    return false;
  }

  // Some reverse proxies/middleware stacks return an empty 403 body.
  // For /api/users/me in the login-to-verify flow, treat this as unverified fallback.
  const requestUrl = error.config?.url;
  return requestUrl === "/api/users/me";
}

function isInvalidRefreshTokenError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) {
    return false;
  }

  return errorMessage.toLowerCase().includes("invalid refresh token");
}

function getVerificationErrorMessage(error: unknown, fallbackMessage: string): string {
  const apiErrorMessage = getParsedApiErrorMessage(error);
  if (apiErrorMessage) {
    return apiErrorMessage;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function getSessionEmail(email: string | null | undefined): string {
  if (!email) {
    throw new Error("You are not signed in.");
  }

  return email.trim().toLowerCase();
}

export function useEmailVerification() {
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const getValidatedSession = async (): Promise<Awaited<ReturnType<typeof authService.getSession>>["data"]["session"]> => {
    const {
      data: { session },
      error,
    } = await authService.getSession();

    if (!error) {
      return session;
    }

    debugAuthVerification("supabase.getSession failed", { message: error.message });

    if (isInvalidRefreshTokenError(error.message)) {
      await authService.signOut();
      clearAuth();
      throw new Error("Your session expired. Please sign in again.");
    }

    throw new Error(error.message || "Could not load your session.");
  };

  const getActiveSessionEmail = async (): Promise<string> => {
    const session = await getValidatedSession();
    const storeSessionEmail = useAuthStore.getState().session?.user?.email;

    const email = getSessionEmail(session?.user?.email ?? storeSessionEmail);
    debugAuthVerification("resolved active session email", { email });
    return email;
  };

  const refreshEmailVerificationStatus = async (): Promise<boolean> => {
    const session = await getValidatedSession();

    if (!session) {
      debugAuthVerification("no active session while refreshing email verification status");
      setEmailVerified(false);
      return false;
    }

    try {
      debugAuthVerification("requesting /api/users/me for email verification status");
      const profile = await usersApiClient.getCurrentUserProfile();
      setEmailVerified(profile.emailVerified);
      debugAuthVerification("received email verification status", { emailVerified: profile.emailVerified });
      return profile.emailVerified;
    } catch (error) {
      if (isEmailNotVerifiedResponse(error)) {
        debugAuthVerification("backend reported EMAIL_NOT_VERIFIED");
        setEmailVerified(false);
        return false;
      }

      const errorMessage = getVerificationErrorMessage(error, "Could not load your profile.");
      debugAuthVerification("failed to refresh email verification status", { message: errorMessage });
      
      // Log the full error details for debugging
      if (error instanceof AxiosError && __DEV__) {
        console.error("[auth/verification] API error:", {
          status: error.response?.status,
          code: getApiErrorCode(error),
          message: error.message,
          url: error.config?.url,
        });
      }
      
      throw new Error(errorMessage);
    }
  };

  const sendVerificationOtp = async (): Promise<void> => {
    const email = await getActiveSessionEmail();
    debugAuthVerification("sending verification OTP", { email });
    const { error } = await authService.sendVerificationOtp(email);

    if (error) {
      debugAuthVerification("sendVerificationOtp failed", { message: error.message });
      throw new Error(error.message || "Could not send the verification code.");
    }

    debugAuthVerification("verification OTP sent");
  };

  const verifyEmailOtp = async (otpCode: string): Promise<void> => {
    const email = await getActiveSessionEmail();
    const token = otpCode.trim();

    if (token.length !== 6) {
      throw new Error("Enter the 6-digit verification code.");
    }

    debugAuthVerification("verifying OTP", { email });
    const { error: otpError } = await authService.verifyEmailOtp(email, token);
    if (otpError) {
      debugAuthVerification("verifyEmailOtp failed", { message: otpError.message });
      throw new Error(otpError.message || "The code is invalid or expired.");
    }

    const { error: refreshError } = await authService.getSession();
    if (refreshError) {
      debugAuthVerification("session refresh after OTP failed", { message: refreshError.message });
      throw new Error(refreshError.message || "Could not refresh your session.");
    }

    const isAlreadyVerified = await refreshEmailVerificationStatus();
    if (!isAlreadyVerified) {
      try {
        debugAuthVerification("calling PATCH /api/users/email-verification");
        await usersApiClient.markEmailVerified();
        debugAuthVerification("email verification marked in backend");
      } catch (error) {
        const message = getVerificationErrorMessage(error, "Could not complete email verification.");
        debugAuthVerification("markEmailVerified failed", { message });
        throw new Error(message);
      }
    }

    setEmailVerified(true);
    debugAuthVerification("email verification flow completed");
  };

  return {
    refreshEmailVerificationStatus,
    sendVerificationOtp,
    verifyEmailOtp,
  };
}
