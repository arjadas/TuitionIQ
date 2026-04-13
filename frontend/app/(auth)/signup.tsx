import { useEmailVerification } from "@/src/features/auth/hooks/useEmailVerification";
import { authService } from "@/src/features/auth/services/authService";
import { PasswordInput } from "@/src/shared/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/src/shared/components/ui/PasswordStrengthMeter";
import { validatePassword } from "@/src/shared/utils/passwordValidation";
import { useAuthStore } from "@/src/store/authStore";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function isExistingUserError(message: string): boolean {
  return message.toLowerCase().includes("user already registered");
}

export default function SignupScreen() {
  const router = useRouter();
  const { refreshEmailVerificationStatus } = useEmailVerification();
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);

  const canSubmit = useMemo(() => {
    return (
      firstName.trim().length > 0
      && lastName.trim().length > 0
      && email.trim().length > 0
      && password.length > 0
      && confirmPassword.length > 0
      && !isSubmitting
    );
  }, [confirmPassword.length, email, firstName, isSubmitting, lastName, password.length]);

  const submit = async (): Promise<void> => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName || !normalizedEmail || !password || !confirmPassword) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (!passwordValidation.isValid) {
      setErrorMessage("Password does not meet the security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { data, error } = await authService.signUp({
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (isExistingUserError(error.message)) {
        setErrorMessage("An account with this email already exists. Please log in instead.");
        router.replace(`/(auth)/login?email=${encodeURIComponent(normalizedEmail)}` as Href);
      } else {
        setErrorMessage(error.message || "Could not create your account right now.");
      }

      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
    }

    try {
      const isVerified = await refreshEmailVerificationStatus();
      router.replace((isVerified ? "/home" : "/(verify)/verify-email") as Href);
    } catch {
      router.replace("/(verify)/verify-email" as Href);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Sign up with email and password to continue.</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>First name</Text>
            <TextInput onChangeText={setFirstName} placeholder="First name" style={styles.input} value={firstName} />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Last name</Text>
            <TextInput onChangeText={setLastName} placeholder="Last name" style={styles.input} value={lastName} />
          </View>

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
            placeholder="Create password"
            value={password}
          />

          <PasswordStrengthMeter password={password} />

          <PasswordInput
            label="Confirm password"
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            value={confirmPassword}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

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
              <Text style={styles.primaryButtonText}>Create account</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/login")} style={styles.footerLinkWrap}>
            <Text style={styles.footerLink}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f7fa",
  },
  contentContainer: {
    flexGrow: 1,
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
  footerLinkWrap: {
    alignItems: "center",
    marginTop: 4,
  },
  footerLink: {
    color: "#35556d",
    fontSize: 14,
  },
});
