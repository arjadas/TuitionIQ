import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type Href, router } from "expo-router";
import { authService } from "@/src/features/auth/services/authService";
import { PasswordInput } from "@/src/shared/components/ui/PasswordInput";
import { validatePassword } from "@/src/shared/utils/passwordValidation";
import { useAuthStore } from "@/src/store/authStore";

type SignUpFormProps = {
  initialEmail?: string;
  emailReadOnly?: boolean;
  hideLoginLink?: boolean;
  onSuccess?: (result: { email: string; emailVerified: boolean }) => Promise<void> | void;
};

function isAlreadyRegisteredError(message: string): boolean
{
  return message.toLowerCase().includes("user already registered");
}

export function SignUpForm({
  initialEmail,
  emailReadOnly = false,
  hideLoginLink = false,
  onSuccess,
}: SignUpFormProps)
{
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setEmailVerified = useAuthStore((state) => state.setEmailVerified);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingAccountError, setExistingAccountError] = useState(false);

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

  async function handleSubmit(): Promise<void>
  {
    if (!canSubmit) {
      return;
    }

    if (!passwordValidation.valid) {
      setErrorMessage(passwordValidation.errors[0] ?? "Password is not strong enough.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    setErrorMessage(null);
    setExistingAccountError(false);

    const { data, error } = await authService.signUp({
      email: normalizedEmail,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });

    if (error) {
      if (isAlreadyRegisteredError(error.message)) {
        setErrorMessage("An account with this email already exists. Please log in.");
        setExistingAccountError(true);
      } else {
        setErrorMessage(error.message || "Could not create your account.");
      }
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
    }

    setEmailVerified(false);

    if (onSuccess) {
      await onSuccess({ email: normalizedEmail, emailVerified: false });
    } else {
      router.replace("/(verify)/verify-email" as Href);
    }

    setIsSubmitting(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Create account</Text>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>First name</Text>
        <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} placeholder="First name" />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Last name</Text>
        <TextInput value={lastName} onChangeText={setLastName} style={styles.input} placeholder="Last name" />
      </View>

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
        placeholder="Create a password"
        showStrength
      />

      <PasswordInput
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm your password"
      />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable disabled={!canSubmit} onPress={() => void handleSubmit()} style={[styles.button, !canSubmit && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{isSubmitting ? "Creating account..." : "Sign up"}</Text>
      </Pressable>

      {existingAccountError ? (
        <Pressable onPress={() => router.replace("/(auth)/login" as Href)}>
          <Text style={styles.existingAccountLink}>Go to login</Text>
        </Pressable>
      ) : null}

      {!hideLoginLink ? (
        <Pressable onPress={() => router.push("/(auth)/login" as Href)}>
          <Text style={styles.footerLink}>Already have an account? Log in.</Text>
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
  existingAccountLink: {
    textAlign: "center",
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 14,
  },
  footerLink: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
  },
});
