import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { authService } from "@/src/features/auth/services/authService";
import { supabase } from "@/src/lib/supabase";
import { PasswordInput } from "@/src/shared/components/ui/PasswordInput";
import { stripUrlParam } from "@/src/shared/utils/stripUrlParam";
import { validatePassword } from "@/src/shared/utils/passwordValidation";

export function ResetPasswordForm()
{
  const params = useLocalSearchParams<{ code?: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = typeof params.code === "string" ? params.code : "";

    if (code) {
      stripUrlParam("code");
    }

    if (!code) {
      setIsPreparing(false);
      return;
    }

    void (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setErrorMessage(error.message || "Reset link is invalid or expired.");
      }

      setIsPreparing(false);
    })();
  }, [params.code]);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const canSubmit = !isPreparing && !isSubmitting && password.length > 0 && confirmPassword.length > 0;

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

    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await authService.updatePassword(password);
    if (error) {
      setErrorMessage(error.message || "Could not update password.");
      setIsSubmitting(false);
      return;
    }

    await authService.signOut();
    router.replace("/(auth)/login" as Href);
    setIsSubmitting(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Set a new password</Text>

      <PasswordInput
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter new password"
        showStrength
      />

      <PasswordInput
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm new password"
      />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable disabled={!canSubmit} onPress={() => void handleSubmit()} style={[styles.button, !canSubmit && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>
          {isPreparing ? "Preparing..." : isSubmitting ? "Updating..." : "Update password"}
        </Text>
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
});
