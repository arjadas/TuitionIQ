import { useInviteFlow } from "@/src/features/invites/hooks/useInviteFlow";
import { authService } from "@/src/features/auth/services/authService";
import { PasswordInput } from "@/src/shared/components/ui/PasswordInput";
import { stripUrlParam } from "@/src/shared/utils/stripUrlParam";
import { useAuthStore } from "@/src/store/authStore";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

export default function JoinScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const session = useAuthStore((state) => state.session);

  const [initialToken, setInitialToken] = useState<string | null>(null);
  const [initialEmail, setInitialEmail] = useState<string | null>(null);
  const hasCapturedParams = useRef(false);

  useEffect(() => {
    if (hasCapturedParams.current) {
      return;
    }

    const token = typeof params.token === "string" ? params.token.trim() : "";
    const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";

    if (token.length > 0) {
      setInitialToken(token);
      stripUrlParam("token");
    }

    if (email.length > 0) {
      setInitialEmail(email);
      stripUrlParam("email");
    }

    hasCapturedParams.current = true;
  }, [params.email, params.token]);

  const {
    authMode,
    setAuthMode,
    stage,
    inviteToken,
    email,
    setEmail,
    emailReadOnly,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    otpCode,
    setOtpCode,
    cooldownRemaining,
    canResendOtp,
    isWorking,
    errorMessage,
    infoMessage,
    submitAuth,
    continueWithSession,
    resendOtp,
    verifyOtpAndAccept,
  } = useInviteFlow({ initialToken, initialEmail });

  const renderAuthModeSwitch = () => (
    <View style={styles.modeSwitchRow}>
      <Pressable
        onPress={() => setAuthMode("login")}
        style={[styles.modeSwitchButton, authMode === "login" ? styles.modeSwitchActive : null]}
      >
        <Text style={[styles.modeSwitchText, authMode === "login" ? styles.modeSwitchTextActive : null]}>
          I already have an account
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setAuthMode("signup")}
        style={[styles.modeSwitchButton, authMode === "signup" ? styles.modeSwitchActive : null]}
      >
        <Text style={[styles.modeSwitchText, authMode === "signup" ? styles.modeSwitchTextActive : null]}>
          I need an account
        </Text>
      </Pressable>
    </View>
  );

  const renderAuthenticationStep = () => {
    if (session) {
      return (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Continue with your current account</Text>
          <Text style={styles.sectionBody}>Signed in as {session.user.email ?? "your account"}.</Text>
          <Pressable
            disabled={isWorking}
            onPress={() => {
              void continueWithSession();
            }}
            style={[styles.primaryButton, isWorking && styles.primaryButtonDisabled]}
          >
            {isWorking ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue and accept invite</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              void authService.signOut();
            }}
            style={styles.inlineLinkWrap}
          >
            <Text style={styles.inlineLink}>Use a different account</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.sectionBlock}>
        {renderAuthModeSwitch()}

        {authMode === "signup" ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              onChangeText={setFirstName}
              placeholder="First name"
              style={styles.input}
              value={firstName}
            />
          </View>
        ) : null}

        {authMode === "signup" ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              onChangeText={setLastName}
              placeholder="Last name"
              style={styles.input}
              value={lastName}
            />
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!emailReadOnly}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@school.com"
            style={[styles.input, emailReadOnly ? styles.readOnlyInput : null]}
            value={email}
          />
        </View>

        <PasswordInput
          label="Password"
          onChangeText={setPassword}
          placeholder={authMode === "login" ? "Enter password" : "Create password"}
          value={password}
        />

        {authMode === "signup" ? (
          <PasswordInput
            label="Confirm password"
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            value={confirmPassword}
          />
        ) : null}

        <Pressable
          disabled={isWorking}
          onPress={() => {
            void submitAuth();
          }}
          style={[styles.primaryButton, isWorking && styles.primaryButtonDisabled]}
        >
          {isWorking ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {authMode === "login" ? "Sign in and continue" : "Create account and continue"}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  const renderOtpStep = () => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>Verify your email</Text>
      <Text style={styles.sectionBody}>Enter the 6-digit code we sent to your email.</Text>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Verification code</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={setOtpCode}
          placeholder="000000"
          style={styles.otpInput}
          value={otpCode}
        />
      </View>

      <Pressable
        disabled={isWorking || otpCode.trim().length !== 6}
        onPress={() => {
          void verifyOtpAndAccept();
        }}
        style={[styles.primaryButton, (isWorking || otpCode.trim().length !== 6) && styles.primaryButtonDisabled]}
      >
        {isWorking ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryButtonText}>Verify and accept invite</Text>
        )}
      </Pressable>

      <Pressable
        disabled={!canResendOtp}
        onPress={() => {
          void resendOtp();
        }}
        style={[styles.secondaryButton, !canResendOtp && styles.secondaryButtonDisabled]}
      >
        <Text style={styles.secondaryButtonText}>
          {cooldownRemaining > 0 ? `Resend in ${cooldownRemaining}s` : "Resend code"}
        </Text>
      </Pressable>
    </View>
  );

  if (!inviteToken) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Invalid invite</Text>
          <Text style={styles.sectionBody}>This invite link is missing a token or has already been used.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.kicker}>TuitionIQ</Text>
          <Text style={styles.title}>Join your organization</Text>
          <Text style={styles.subtitle}>
            Complete sign in, verify your email if needed, and accept your invitation.
          </Text>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

          {stage === "otp" ? renderOtpStep() : renderAuthenticationStep()}
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
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: "#0d9488",
    textTransform: "uppercase",
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
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionBody: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  modeSwitchRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeSwitchButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  modeSwitchActive: {
    borderColor: "#0e7ef2",
    backgroundColor: "#eff6ff",
  },
  modeSwitchText: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
  },
  modeSwitchTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
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
  readOnlyInput: {
    backgroundColor: "#f8fafc",
    color: "#475569",
  },
  otpInput: {
    borderWidth: 1,
    borderColor: "#c5d6e4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 4,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    textAlign: "center",
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
    textAlign: "center",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0e7ef2",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: "#0e7ef2",
    fontSize: 15,
    fontWeight: "600",
  },
  inlineLinkWrap: {
    alignSelf: "flex-start",
  },
  inlineLink: {
    color: "#0d9488",
    fontSize: 13,
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
