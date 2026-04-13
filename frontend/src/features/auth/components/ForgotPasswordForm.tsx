import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type Href, router } from "expo-router";
import { authService } from "@/src/features/auth/services/authService";

const RESEND_COOLDOWN_SECONDS = 60;

type ForgotPasswordFormProps = {
  initialEmail?: string;
};

function getPlatformRedirectUrl(): string
{
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth/reset-password`;
  }

  return Linking.createURL("auth/reset-password");
}

export function ForgotPasswordForm({ initialEmail }: ForgotPasswordFormProps)
{
  const [email, setEmail] = useState(initialEmail ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

  const canSubmit = email.trim().length > 0 && cooldownRemaining === 0 && !isSubmitting;

  async function handleSubmit(): Promise<void>
  {
    if (!canSubmit) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setIsSubmitting(true);

    await authService.resetPasswordForEmail(normalizedEmail, getPlatformRedirectUrl());

    setMessage("If an account with that email exists, a reset link has been sent.");
    setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    setIsSubmitting(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Enter your email to receive a reset link.</Text>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
          placeholder="name@example.com"
        />
      </View>

      {message ? <Text style={styles.infoText}>{message}</Text> : null}

      <Pressable disabled={!canSubmit} onPress={() => void handleSubmit()} style={[styles.button, !canSubmit && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>
          {isSubmitting
            ? "Sending..."
            : cooldownRemaining > 0
              ? `Resend in ${cooldownRemaining}s`
              : "Send reset link"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/(auth)/login" as Href)}>
        <Text style={styles.footerLink}>Back to login</Text>
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
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#ffffff",
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
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  footerLink: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
  },
});
