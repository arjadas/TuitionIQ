import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useEmailVerification } from "@/src/features/auth/hooks/useEmailVerification";
import { authService } from "@/src/features/auth/services/authService";
import { invitesApiClient } from "@/src/features/invites/services/invitesApiClient";
import { validatePassword } from "@/src/shared/utils/passwordValidation";
import { useAuthStore } from "@/src/store/authStore";
import { useOrgStore } from "@/src/store/orgStore";

const OTP_COOLDOWN_SECONDS = 60;

export type InviteAuthMode = "login" | "signup";
export type InviteStage = "authenticate" | "otp" | "accepting";

type UseInviteFlowArgs = {
  initialToken: string | null;
  initialEmail: string | null;
};

type ApiErrorResponse = {
  code?: string;
};

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as ApiErrorResponse | undefined;
    if (error.response?.status === 403 && responseData?.code === "EMAIL_NOT_VERIFIED") {
      return "Verify your email first to accept this invite.";
    }

    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export function useInviteFlow({ initialToken, initialEmail }: UseInviteFlowArgs) {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const emailVerified = useAuthStore((state) => state.emailVerified);
  const selectOrg = useOrgStore((state) => state.selectOrg);

  const { refreshEmailVerificationStatus, sendVerificationOtp, verifyEmailOtp } = useEmailVerification();

  const [inviteToken, setInviteToken] = useState<string | null>(initialToken);
  const [authMode, setAuthMode] = useState<InviteAuthMode>("login");

  const [email, setEmail] = useState(initialEmail ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otpCode, setOtpCode] = useState("");
  const [stage, setStage] = useState<InviteStage>("authenticate");

  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [otpCooldownEndsAt, setOtpCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (initialToken && !inviteToken) {
      setInviteToken(initialToken);
    }
  }, [initialToken, inviteToken]);

  useEffect(() => {
    if (initialEmail && email.trim().length === 0) {
      setEmail(initialEmail.toLowerCase());
    }
  }, [email, initialEmail]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const cooldownRemaining = useMemo(() => {
    if (!otpCooldownEndsAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((otpCooldownEndsAt - now) / 1000));
  }, [now, otpCooldownEndsAt]);

  const canResendOtp = cooldownRemaining === 0 && !isWorking;

  const emailReadOnly = useMemo(() => {
    if (session?.user?.email) {
      return true;
    }

    return Boolean(initialEmail);
  }, [initialEmail, session?.user?.email]);

  const sendOtp = async (): Promise<void> => {
    await sendVerificationOtp();
    setOtpCooldownEndsAt(Date.now() + OTP_COOLDOWN_SECONDS * 1000);
    setInfoMessage("Verification code sent. Check your inbox and spam folder.");
  };

  const acceptInvite = async (): Promise<void> => {
    if (!inviteToken) {
      throw new Error("Invite token is missing or invalid.");
    }

    setStage("accepting");
    const response = await invitesApiClient.acceptInvite(inviteToken);
    if (response.organizationId) {
      selectOrg(response.organizationId);
    }

    setInviteToken(null);
    router.replace("/home");
  };

  const beginOtpStep = async (): Promise<void> => {
    await sendOtp();
    setStage("otp");
  };

  const continueWithSession = async (): Promise<void> => {
    if (!session) {
      throw new Error("Sign in first to accept this invite.");
    }

    const verifiedNow = emailVerified || (await refreshEmailVerificationStatus());
    if (verifiedNow) {
      await acceptInvite();
      return;
    }

    await beginOtpStep();
  };

  const submitAuth = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsWorking(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (!inviteToken) {
        throw new Error("Invite token is missing or invalid.");
      }

      if (authMode === "login") {
        if (!normalizedEmail || !password) {
          throw new Error("Email and password are required.");
        }

        const { error } = await authService.signInWithPassword(normalizedEmail, password);
        if (error) {
          throw new Error(error.message || "Could not sign in.");
        }
      } else {
        if (!firstName.trim() || !lastName.trim() || !normalizedEmail || !password) {
          throw new Error("All fields are required for sign up.");
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
          throw new Error("Password does not meet security requirements.");
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const { error } = await authService.signUp({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: normalizedEmail,
          password,
        });

        if (error) {
          throw new Error(error.message || "Could not create your account.");
        }
      }

      await continueWithSession();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Could not continue with invite."));
      setStage("authenticate");
    } finally {
      setIsWorking(false);
    }
  };

  const resendOtp = async (): Promise<void> => {
    if (!canResendOtp) {
      return;
    }

    setErrorMessage(null);
    setIsWorking(true);

    try {
      await sendOtp();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Could not resend verification code."));
    } finally {
      setIsWorking(false);
    }
  };

  const verifyOtpAndAccept = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsWorking(true);

    try {
      await verifyEmailOtp(otpCode);
      await acceptInvite();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Could not verify the code."));
      setStage("otp");
    } finally {
      setIsWorking(false);
    }
  };

  return {
    authMode,
    setAuthMode,
    stage,
    inviteToken,
    email,
    setEmail,
    emailReadOnly,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    otpCode,
    setOtpCode,
    cooldownRemaining,
    canResendOtp,
    isWorking,
    errorMessage,
    infoMessage,
    submitAuth,
    continueWithSession,
    resendOtp,
    verifyOtpAndAccept,
  };
}
