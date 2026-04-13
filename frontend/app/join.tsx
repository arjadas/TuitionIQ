import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { EmailOtpVerificationForm } from "@/src/features/auth/components/EmailOtpVerificationForm";
import { LoginForm } from "@/src/features/auth/components/LoginForm";
import { SignUpForm } from "@/src/features/auth/components/SignUpForm";
import { apiClient } from "@/src/lib/apiClient";
import { stripUrlParam } from "@/src/shared/utils/stripUrlParam";
import { useAuthStore } from "@/src/store/authStore";

type JoinMode = "login" | "signup";

export default function JoinScreen()
{
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const session = useAuthStore((state) => state.session);
  const emailVerified = useAuthStore((state) => state.emailVerified);

  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<JoinMode>("login");
  const [detectedMode, setDetectedMode] = useState<JoinMode | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof params.token === "string" ? params.token.trim() : "";
    const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";

    if (token.length > 0) {
      setInviteToken(token);
      stripUrlParam("token");
    }

    if (email.length > 0) {
      setInviteEmail(email);
      stripUrlParam("email");
    }
  }, [params.email, params.token]);

  useEffect(() => {
    if (!inviteEmail || session) {
      return;
    }

    void (async () => {
      setIsCheckingAccount(true);
      try {
        const { data } = await apiClient.get<{ email: string; exists: boolean }>("/api/auth/account-exists", {
          params: { email: inviteEmail },
        });

        setDetectedMode(data.exists ? "login" : "signup");
      } catch {
        setDetectedMode("login");
      } finally {
        setIsCheckingAccount(false);
      }
    })();
  }, [inviteEmail, session]);

  const resolvedMode = detectedMode ?? mode;
  const isModeLocked = detectedMode !== null;

  const canAcceptInvite = useMemo(() => {
    return !!session && !!inviteToken && emailVerified;
  }, [emailVerified, inviteToken, session]);

  async function acceptInvite(): Promise<void>
  {
    if (!inviteToken) {
      setErrorMessage("Invite token is missing or invalid.");
      return;
    }

    setIsAccepting(true);
    setErrorMessage(null);

    try {
      await apiClient.post("/api/invites/accept", { token: inviteToken });
      router.replace("/home" as Href);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not accept invite.";
      setErrorMessage(message);
    } finally {
      setIsAccepting(false);
    }
  }

  useEffect(() => {
    if (!canAcceptInvite || isAccepting) {
      return;
    }

    void acceptInvite();
  }, [canAcceptInvite, isAccepting]);

  function handleAuthSuccess(result: { email: string; emailVerified: boolean }): Promise<void> | void
  {
    if (result.emailVerified) {
      return acceptInvite();
    }

    setNeedsVerification(true);
  }

  if (!inviteToken) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Invalid invite</Text>
          <Text style={styles.subtitle}>This invite link is missing a valid token.</Text>
          <Pressable onPress={() => router.replace("/(auth)/login" as Href)}>
            <Text style={styles.footerLink}>Go to login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (needsVerification || (session && !emailVerified)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Verify to continue</Text>
          <Text style={styles.subtitle}>Complete email verification to accept this invite.</Text>
          <EmailOtpVerificationForm onVerified={acceptInvite} />
        </View>
      </SafeAreaView>
    );
  }

  if (session && emailVerified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Accepting invite...</Text>
          <Text style={styles.subtitle}>Please wait while we add you to the organization.</Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Join TuitionIQ</Text>
        <Text style={styles.subtitle}>Use the invited email to continue.</Text>

        {inviteEmail ? <Text style={styles.emailHint}>Invite email: {inviteEmail}</Text> : null}

        <View style={styles.switchRow}>
          {isModeLocked ? (
            <Text style={styles.modeHint}>
              {resolvedMode === "login"
                ? "We found an existing account for this email. Please log in."
                : "No account found for this email. Please sign up first."}
            </Text>
          ) : (
            <>
              <Pressable
                onPress={() => setMode("login")}
                style={[styles.switchButton, resolvedMode === "login" && styles.switchButtonActive]}
              >
                <Text style={[styles.switchText, resolvedMode === "login" && styles.switchTextActive]}>I have an account</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("signup")}
                style={[styles.switchButton, resolvedMode === "signup" && styles.switchButtonActive]}
              >
                <Text style={[styles.switchText, resolvedMode === "signup" && styles.switchTextActive]}>I need an account</Text>
              </Pressable>
            </>
          )}
        </View>

        {isCheckingAccount ? (
          <Text style={styles.checkingText}>Checking invite account status...</Text>
        ) : null}

        {resolvedMode === "login" ? (
          <LoginForm
            initialEmail={inviteEmail ?? undefined}
            emailReadOnly={!!inviteEmail}
            hideSignUpLink
            onSuccess={handleAuthSuccess}
          />
        ) : (
          <SignUpForm
            initialEmail={inviteEmail ?? undefined}
            emailReadOnly={!!inviteEmail}
            hideLoginLink
            onSuccess={handleAuthSuccess}
          />
        )}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    padding: 20,
  },
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
  emailHint: {
    fontSize: 13,
    color: "#0f766e",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    gap: 8,
  },
  switchButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  switchButtonActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff",
  },
  switchText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  switchTextActive: {
    color: "#1d4ed8",
  },
  modeHint: {
    flex: 1,
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },
  checkingText: {
    color: "#475569",
    fontSize: 12,
    textAlign: "center",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
  },
  footerLink: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
  },
});
