import { authService } from "@/src/features/auth/services/authService";
import { PasswordInput } from "@/src/shared/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/src/shared/components/ui/PasswordStrengthMeter";
import { validatePassword } from "@/src/shared/utils/passwordValidation";
import { stripUrlParam } from "@/src/shared/utils/stripUrlParam";
import { useAuthStore } from "@/src/store/authStore";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const params = useLocalSearchParams<{ code?: string }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasExchangedCode = useRef(false);

  useEffect(() => {
    const code = typeof params.code === "string" ? params.code : null;

    if (code) {
      stripUrlParam("code");
    }

    if (!code) {
      setIsPreparing(false);
      return;
    }

    if (hasExchangedCode.current) {
      setIsPreparing(false);
      return;
    }

    hasExchangedCode.current = true;

    void (async () => {
      setIsPreparing(true);
      const { error } = await authService.exchangeCodeForSession(code);
      if (error) {
        setPrepError(error.message || "Could not validate the password reset link.");
      }

      setIsPreparing(false);
    })();
  }, [params.code]);

  const passwordValidation = useMemo(() => validatePassword(newPassword), [newPassword]);

  const canSubmit =
    !isPreparing
    && !isSubmitting
    && newPassword.length > 0
    && confirmPassword.length > 0
    && prepError === null
    && (Boolean(session) || hasExchangedCode.current);

  const submit = async (): Promise<void> => {
    if (!passwordValidation.isValid) {
      setErrorMessage("Password does not meet the security requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const { error } = await authService.updatePassword(newPassword);
    if (error) {
      setErrorMessage(error.message || "Could not update your password.");
      setIsSubmitting(false);
      return;
    }

    await authService.signOut();
    setSuccessMessage("Your password has been updated. Please log in with your new password.");
    setIsSubmitting(false);

    router.replace({
      pathname: "/(auth)/login",
      params: {
        message: "Your password has been updated. Please log in with your new password.",
      },
    });
  };

  if (isPreparing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator color="#1d4ed8" size="large" />
          <Text style={styles.subtitle}>Preparing your password reset session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (prepError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.errorText}>{prepError}</Text>
          <Pressable onPress={() => router.replace("/(auth)/forgot-password" as Href)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Request a new link</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!session && !hasExchangedCode.current) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>Open the password reset link from your email to continue.</Text>
          <Pressable onPress={() => router.replace("/(auth)/forgot-password" as Href)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to forgot password</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Use a strong password you have not used before.</Text>

          <PasswordInput
            label="New password"
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            value={newPassword}
          />

          <PasswordStrengthMeter password={newPassword} />

          <PasswordInput
            label="Confirm password"
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            value={confirmPassword}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.infoText}>{successMessage}</Text> : null}

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
              <Text style={styles.primaryButtonText}>Update password</Text>
            )}
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
    justifyContent: "center",
    padding: 20,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: "center",
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
  },
});
