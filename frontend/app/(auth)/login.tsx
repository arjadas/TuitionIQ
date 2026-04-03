import { supabase } from "@/src/lib/supabase";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const COOLDOWN_SECONDS = 60;

function getEmailRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/callback`;
  }

  return Linking.createURL("/callback");
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setCooldownRemaining((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [cooldownRemaining]);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && !isSubmitting && cooldownRemaining === 0;
  }, [cooldownRemaining, email, isSubmitting]);

  const sendLoginLink = async (): Promise<void> => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Please enter your email.");
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
        },
      });

      if (error) {
        throw error;
      }

      setIsEmailSent(true);
      setCooldownRemaining(COOLDOWN_SECONDS);
      setStatusMessage("Check your email for your login link.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send login link.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEmailApp = async (): Promise<void> => {
    setErrorMessage(null);
    const mailtoUrl = `mailto:${email.trim()}`;

    try {
      const canOpenMailClient = await Linking.canOpenURL(mailtoUrl);

      if (!canOpenMailClient) {
        setErrorMessage("Could not open an email app on this device.");
        return;
      }

      await Linking.openURL(mailtoUrl);
    } catch {
      setErrorMessage("Could not open an email app on this device.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Teacher login</Text>
        <Text style={styles.subtitle}>Use your email to receive a secure magic link.</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@school.com"
          style={styles.input}
          value={email}
        />

        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            void sendLoginLink();
          }}
          style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isEmailSent && cooldownRemaining > 0
                ? `Resend in ${cooldownRemaining}s`
                : "Send login link"}
            </Text>
          )}
        </Pressable>

        {isEmailSent ? (
          <Pressable onPress={() => void openEmailApp()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Open email app</Text>
          </Pressable>
        ) : null}

        {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable onPress={() => router.replace("/")} style={styles.backLink}>
          <Text style={styles.backLinkText}>Back</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#c5d6e4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: "#0e7ef2",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  disabledButton: {
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
  },
  secondaryButtonText: {
    color: "#0e7ef2",
    fontSize: 16,
    fontWeight: "600",
  },
  successText: {
    color: "#0a7f5f",
    fontSize: 14,
  },
  errorText: {
    color: "#bb1f1f",
    fontSize: 14,
  },
  backLink: {
    marginTop: 8,
    alignItems: "center",
  },
  backLinkText: {
    color: "#35556d",
    fontSize: 14,
  },
});
