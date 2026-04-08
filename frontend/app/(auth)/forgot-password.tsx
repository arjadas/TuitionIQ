import { authService } from "@/src/features/auth/services/authService";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const RESET_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const canSubmit = email.trim().length > 0 && cooldownRemaining === 0 && !isSubmitting;

  const submit = async (): Promise<void> => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Email is required.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    await authService.resetPasswordForEmail(normalizedEmail);

    setInfoMessage("If an account exists for this email, a password reset link has been sent.");
    setCooldownEndsAt(Date.now() + RESET_COOLDOWN_SECONDS * 1000);
    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we will send instructions to reset your password.
        </Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@school.com"
            style={styles.input}
            value={email}
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            void submit();
          }}
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {cooldownRemaining > 0
                ? `Resend in ${cooldownRemaining}s`
                : "Send reset link"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push("/(auth)/login")} style={styles.footerLinkWrap}>
          <Text style={styles.footerLink}>Back to login</Text>
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
    fontSize: 16,
    color: "#0f172a",
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
  errorText: {
    color: "#bb1f1f",
    fontSize: 14,
  },
  infoText: {
    color: "#0f766e",
    fontSize: 14,
    lineHeight: 20,
  },
  footerLinkWrap: {
    alignItems: "center",
    marginTop: 4,
  },
  footerLink: {
    color: "#35556d",
    fontSize: 14,
  },
});
