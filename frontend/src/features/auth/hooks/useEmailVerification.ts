import { useCallback } from "react";
import { AxiosError } from "axios";
import { authService } from "@/src/features/auth/services/authService";
import { forceClientSignOut } from "@/src/lib/forceClientSignOut";
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

  const getValidatedSession = useCallback(
    async (): Promise<Awaited<ReturnType<typeof authService.getSession>>["data"]["session"]> => {
      const {
        data: { session },
        error,
      } = await authService.getSession();

      if (!error) {
        return session;
      }

      debugAuthVerification("supabase.getSession failed", { message: error.message });

      if (isInvalidRefreshTokenError(error.message)) {
        await forceClientSignOut();
        throw new Error("Your session expired. Please sign in again.");
      }

      throw new Error(error.message || "Could not load your session.");
    },
    [],
  );

  // Resolve which email to verify. Model B always has a session after signUp()
  // or signInWithPassword() (Supabase "Confirm email" is OFF), so the email comes
  // from the session user; getSessionEmail throws if somehow signed out.
  const resolveVerificationEmail = useCallback(async (): Promise<string> => {
    const session = await getValidatedSession();
    return getSessionEmail(session?.user?.email);
  }, [getValidatedSession]);

  const refreshEmailVerificationStatus = useCallback(async (): Promise<boolean> => {
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
  }, [getValidatedSession, setEmailVerified]);

  const sendVerificationOtp = useCallback(async (): Promise<void> => {
    const email = await resolveVerificationEmail();
    debugAuthVerification("sending verification OTP", { email });

    const { error } = await authService.sendVerificationOtp(email);
    if (error) {
      debugAuthVerification("sendVerificationOtp failed", { message: error.message });
      throw new Error(error.message || "Could not send the verification code.");
    }

    debugAuthVerification("verification OTP sent");
  }, [resolveVerificationEmail]);

  const verifyEmailOtp = useCallback(
    async (otpCode: string): Promise<void> => {
      const email = await resolveVerificationEmail();
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

      // Persist the authoritative flag + audit log via the C# API. verifyOtp(type:'email')
      // reuses the existing session (it does not emit a fresh SIGNED_IN), so this
      // screen's flow is the SOLE writer of emailVerified=true — no listener races it.
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

      // Flip the single source of truth; the status guards navigate to /home.
      setEmailVerified(true);
      debugAuthVerification("email verification flow completed");
    },
    [resolveVerificationEmail, refreshEmailVerificationStatus, setEmailVerified],
  );

  return {
    refreshEmailVerificationStatus,
    sendVerificationOtp,
    verifyEmailOtp,
  };
}
