import { useEmailVerification } from "@/src/features/auth/hooks/useEmailVerification";
import { authService } from "@/src/features/auth/services/authService";
import { useAuthStore } from "@/src/store/authStore";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const { refreshEmailVerificationStatus, sendVerificationOtp, verifyEmailOtp } = useEmailVerification();

  const [otpCode, setOtpCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const hasAutoSentCode = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const cooldownRemaining = useMemo(() => {
    if (!cooldownEndsAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000));
  }, [cooldownEndsAt, now]);

  const canResend = cooldownRemaining === 0 && !isSendingCode;

  const sendCode = useCallback(async (): Promise<void> => {
    setIsSendingCode(true);
    setErrorMessage(null);

    try {
      await sendVerificationOtp();
      setInfoMessage("Verification code sent. Check your inbox and spam folder.");
      setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send verification code.");
    } finally {
      setIsSendingCode(false);
    }
  }, [sendVerificationOtp]);

  useEffect(() => {
    if (hasAutoSentCode.current) {
      return;
    }

    hasAutoSentCode.current = true;
    void (async () => {
      try {
        const isVerified = await refreshEmailVerificationStatus();
        if (isVerified) {
          router.replace("/home");
          return;
        }

        await sendCode();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not send verification code.");
      }
    })();
  }, [refreshEmailVerificationStatus, router, sendCode]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active") {
        return;
      }

      void (async () => {
        try {
          const isVerified = await refreshEmailVerificationStatus();
          if (isVerified) {
            router.replace("/home");
          }
        } catch {
          // Keep user on the verification screen when status refresh fails.
        }
      })();
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [refreshEmailVerificationStatus, router]);

  const verify = async (): Promise<void> => {
    setIsVerifying(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await verifyEmailOtp(otpCode);
      router.replace("/home");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not verify this code.");
    } finally {
      setIsVerifying(false);
    }
  };

  const signOutAndUseDifferentAccount = async (): Promise<void> => {
    await authService.signOut();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit verification code to {session?.user?.email ?? "your email"}.
        </Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Verification code</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setOtpCode}
            placeholder="000000"
            style={styles.input}
            value={otpCode}
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

        <Pressable
          disabled={otpCode.trim().length !== 6 || isVerifying}
          onPress={() => {
            void verify();
          }}
          style={[styles.primaryButton, (otpCode.trim().length !== 6 || isVerifying) && styles.primaryButtonDisabled]}
        >
          {isVerifying ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify email</Text>
          )}
        </Pressable>

        <Pressable
          disabled={!canResend}
          onPress={() => {
            void sendCode();
          }}
          style={[styles.secondaryButton, !canResend && styles.secondaryButtonDisabled]}
        >
          {isSendingCode ? (
            <ActivityIndicator color="#0e7ef2" />
          ) : (
            <Text style={styles.secondaryButtonText}>
              {cooldownRemaining > 0 ? `Resend in ${cooldownRemaining}s` : "Resend code"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            void signOutAndUseDifferentAccount();
          }}
          style={styles.footerLinkWrap}
        >
          <Text style={styles.footerLink}>Use a different account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f7fa",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0e3050",
  },
  subtitle: {
    fontSize: 14,
    color: "#35556d",
    lineHeight: 20,
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
    borderColor: "#c5d6e4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 4,
    color: "#0f172a",
    textAlign: "center",
    backgroundColor: "#ffffff",
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: "#0e7ef2",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0e7ef2",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: "#0e7ef2",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: "#bb1f1f",
    fontSize: 14,
  },
  infoText: {
    color: "#0f766e",
    fontSize: 14,
  },
  footerLinkWrap: {
    alignItems: "center",
    marginTop: 2,
  },
  footerLink: {
    color: "#35556d",
    fontSize: 14,
  },
});
