import { useEmailVerification } from "@/src/features/auth/hooks/useEmailVerification";
import { authService } from "@/src/features/auth/services/authService";
import { PasswordInput } from "@/src/shared/components/ui/PasswordInput";
import { useAuthStore } from "@/src/store/authStore";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

function isInvalidCredentialsError(message: string): boolean {
  return message.toLowerCase().includes("invalid login credentials");
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; message?: string}>();
  const { refreshEmailVerificationStatus } = useEmailVerification();
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params.email === "string" && params.email.trim().length > 0) {
      setEmail(params.email.trim().toLowerCase());
    }
  }, [params.email]);

  useEffect(() => {
    if (typeof params.message === "string" && params.message.trim().length > 0) {
      setSuccessMessage(params.message);

      // Clear the param so it doesn't persist
      router.setParams({ message: "" });
    }
  }, [params.message, router]);

  const showForgotPasswordCta = failedAttempts >= 5;

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !isSubmitting;
  }, [email, isSubmitting, password]);

  const submitLogin = async (): Promise<void> => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { data, error } = await authService.signInWithPassword(normalizedEmail, password);

    if (error) {
      if (isInvalidCredentialsError(error.message)) {
        setFailedAttempts((current) => current + 1);
        setErrorMessage("Incorrect email or password.");
      } else {
        setErrorMessage(error.message || "No internet connection. Check your connection and try again.");
      }

      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
    }

    setFailedAttempts(0);

    try {
      const isVerified = await refreshEmailVerificationStatus();
      router.replace((isVerified ? "/home" : "/(verify)/verify-email") as Href);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not verify your email. Try again or restart the app.";
      console.error("[auth/login] Email verification check failed:", errorMessage);
      setErrorMessage(errorMessage);
      setIsSubmitting(false);
      return;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Manage your students with ease</Text>

        <View style={styles.formSection}>
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

          <PasswordInput
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter password"
            returnKeyType="done"
            value={password}
          />

          <Pressable onPress={() => router.push("/(auth)/forgot-password" as Href)} style={styles.inlineLinkWrap}>
            <Text style={styles.inlineLink}>Forgot password?</Text>
          </Pressable>
        </View>

        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            void submitLogin();
          }}
          style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </Pressable>

        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {showForgotPasswordCta ? (
          <Pressable
            onPress={() => router.push("/(auth)/forgot-password" as Href)}
            style={styles.prominentCta}
          >
            <Text style={styles.prominentCtaTitle}>Forgotten your password?</Text>
            <Text style={styles.prominentCtaBody}>Reset it now to keep signing in securely.</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push("/(auth)/signup" as Href)} style={styles.footerLinkWrap}>
          <Text style={styles.footerLink}>Do not have an account? Sign up</Text>
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
    gap: 14,
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
    fontSize: 15,
    lineHeight: 20,
    color: "#35556d",
  },
  formSection: {
    gap: 10,
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
  inlineLinkWrap: {
    alignSelf: "flex-end",
  },
  inlineLink: {
    color: "#0d9488",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#0e7ef2",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  disabledButton: {
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
  successText: {
    color: "#15803d",
    fontSize: 14,
  },
  prominentCta: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 12,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  prominentCtaTitle: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "700",
  },
  prominentCtaBody: {
    color: "#b45309",
    fontSize: 13,
  },
  footerLinkWrap: {
    alignItems: "center",
  },
  footerLink: {
    color: "#35556d",
    fontSize: 14,
  },
});
