import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type Href, router } from "expo-router";
import { authService } from "@/src/features/auth/services/authService";
import { isApiClientError } from "@/src/lib/apiClient";
import { PasswordInput } from "@/src/shared/components/ui/PasswordInput";
import { useAuthStore } from "@/src/store/authStore";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";

type LoginFormProps = {
  initialEmail?: string;
  emailReadOnly?: boolean;
  hideSignUpLink?: boolean;
  onSuccess?: (result: { email: string; emailVerified: boolean }) => Promise<void> | void;
};

export function LoginForm({
  initialEmail,
  emailReadOnly = false,
  hideSignUpLink = false,
  onSuccess,
}: LoginFormProps)
{
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);

  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !isSubmitting;
  }, [email, isSubmitting, password]);

  async function handleSubmit(): Promise<void>
  {
    if (!canSubmit) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    setErrorMessage(null);

    const { data, error } = await authService.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setFailedAttempts((value) => value + 1);
      setErrorMessage("Incorrect email or password.");
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
    }

    let verified = false;
    try {
      const profile = await usersApiClient.getCurrentUserProfile();
      verified = profile.emailVerified;
      setEmailVerified(profile.emailVerified);
    } catch (profileError) {
      if (isApiClientError(profileError) && profileError.code === "EMAIL_NOT_VERIFIED") {
        verified = false;
        setEmailVerified(false);
      } else {
        setErrorMessage("Could not complete sign in. Please try again.");
        setIsSubmitting(false);
        return;
      }
    }

    setFailedAttempts(0);

    if (onSuccess) {
      await onSuccess({ email: normalizedEmail, emailVerified: verified });
    } else {
      router.replace((verified ? "/home" : "/(verify)/verify-email") as Href);
    }

    setIsSubmitting(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sign in</Text>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!emailReadOnly}
          style={[styles.input, emailReadOnly && styles.readOnlyInput]}
          placeholder="name@example.com"
        />
      </View>

      <PasswordInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
      />

      <Pressable onPress={() => router.push("/(auth)/forgot-password" as Href)}>
        <Text style={styles.inlineLink}>Forgot your password?</Text>
      </Pressable>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable disabled={!canSubmit} onPress={() => void handleSubmit()} style={[styles.button, !canSubmit && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{isSubmitting ? "Signing in..." : "Sign in"}</Text>
      </Pressable>

      {failedAttempts >= 5 ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Need help signing in?</Text>
          <Text style={styles.alertBody}>Reset your password if you have tried multiple times.</Text>
          <Pressable onPress={() => router.push("/(auth)/forgot-password" as Href)}>
            <Text style={styles.alertLink}>Go to password reset</Text>
          </Pressable>
        </View>
      ) : null}

      {!hideSignUpLink ? (
        <Pressable onPress={() => router.push("/(auth)/signup" as Href)}>
          <Text style={styles.footerLink}>No account yet? Sign up.</Text>
        </Pressable>
      ) : null}
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
  readOnlyInput: {
    backgroundColor: "#f8fafc",
    color: "#475569",
  },
  inlineLink: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  errorText: {
    color: "#b91c1c",
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
  alertCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    padding: 12,
    gap: 4,
  },
  alertTitle: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "700",
  },
  alertBody: {
    color: "#92400e",
    fontSize: 13,
  },
  alertLink: {
    marginTop: 2,
    color: "#92400e",
    fontSize: 13,
    fontWeight: "700",
  },
  footerLink: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
  },
});
