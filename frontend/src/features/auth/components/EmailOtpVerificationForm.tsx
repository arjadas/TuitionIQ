import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type Href, router } from "expo-router";
import { authService } from "@/src/features/auth/services/authService";
import { useEmailVerification } from "@/src/features/auth/hooks/useEmailVerification";

type EmailOtpVerificationFormProps = {
  onVerified?: () => Promise<void> | void;
};

export function EmailOtpVerificationForm({ onVerified }: EmailOtpVerificationFormProps)
{
  const { sendOtp, verifyOtp, cooldownRemaining, canResend } = useEmailVerification();

  const [otpCode, setOtpCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const hasAutoSent = useRef(false);

  useEffect(() => {
    if (hasAutoSent.current) {
      return;
    }

    hasAutoSent.current = true;
    void (async () => {
      setIsSending(true);
      try {
        await sendOtp();
        setInfoMessage("We sent a verification code to your email.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not send verification code.";
        setErrorMessage(message);
      } finally {
        setIsSending(false);
      }
    })();
  }, [sendOtp]);

  async function handleResend(): Promise<void>
  {
    if (!canResend || isSending) {
      return;
    }

    setErrorMessage(null);
    setIsSending(true);

    try {
      await sendOtp();
      setInfoMessage("A new verification code has been sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not resend verification code.";
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  }

  async function handleVerify(): Promise<void>
  {
    if (otpCode.trim().length !== 6 || isVerifying) {
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);

    try {
      await verifyOtp(otpCode);
      if (onVerified) {
        await onVerified();
      } else {
        router.replace("/home" as Href);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid verification code.";
      setErrorMessage(message);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleUseDifferentAccount(): Promise<void>
  {
    await authService.signOut();
    router.replace("/(auth)/login" as Href);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to your inbox.</Text>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Verification code</Text>
        <TextInput
          value={otpCode}
          onChangeText={setOtpCode}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.input}
          placeholder="000000"
        />
      </View>

      <Text style={styles.helperText}>Check your spam folder if the code does not arrive.</Text>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

      <Pressable
        disabled={otpCode.trim().length !== 6 || isVerifying}
        onPress={() => void handleVerify()}
        style={[styles.button, (otpCode.trim().length !== 6 || isVerifying) && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{isVerifying ? "Verifying..." : "Verify code"}</Text>
      </Pressable>

      <Pressable
        disabled={!canResend || isSending}
        onPress={() => void handleResend()}
        style={[styles.secondaryButton, (!canResend || isSending) && styles.buttonDisabled]}
      >
        <Text style={styles.secondaryButtonText}>
          {isSending
            ? "Sending..."
            : cooldownRemaining > 0
              ? `Resend in ${cooldownRemaining}s`
              : "Resend code"}
        </Text>
      </Pressable>

      <Pressable onPress={() => void handleUseDifferentAccount()}>
        <Text style={styles.footerLink}>Use a different account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: "center",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  helperText: {
    color: "#64748b",
    fontSize: 12,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
  },
  infoText: {
    color: "#0f766e",
    fontSize: 13,
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d4ed8",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1d4ed8",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "700",
  },
  footerLink: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
  },
});
