import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateProfileRequest, UserProfileDto } from "@tuitioniq/types";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { authService } from "@/src/features/auth/services/authService";
import { useCurrentUser, usersMeQueryKey } from "@/src/features/users/hooks/useCurrentUser";
import { usersApiClient } from "@/src/features/users/services/usersApiClient";
import { forceClientSignOut } from "@/src/lib/forceClientSignOut";
import { resetClientSessionState } from "@/src/lib/resetClientSessionState";
import { Button } from "@/src/shared/components/ui/Button";
import { SettingRow } from "@/src/shared/components/ui/SettingRow";
import { SettingsSection } from "@/src/shared/components/ui/SettingsSection";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { colors, radius, spacing } from "@/src/shared/theme/tokens";

export default function ProfileSettingsScreen() {
  const userQuery = useCurrentUser();

  if (userQuery.isPending) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.stateBody}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Could not load profile</Text>
          <Text style={styles.stateBody}>
            {getApiErrorMessage(userQuery.error) ?? "Please try again."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <ProfileSettingsContent user={userQuery.data} />;
}

function ProfileSettingsContent({ user }: { user: UserProfileDto }) {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateProfileRequest) => usersApiClient.updateProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(usersMeQueryKey, updated);
      setValidationError(null);
    },
  });

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedPhone = phone.trim();
  const isDirty =
    trimmedFirst !== user.firstName
    || trimmedLast !== user.lastName
    || trimmedPhone !== (user.phone ?? "");
  const canSave = trimmedFirst.length > 0 && trimmedLast.length > 0 && isDirty && !updateMutation.isPending;

  const saveProfile = async (): Promise<void> => {
    if (trimmedFirst.length === 0 || trimmedLast.length === 0) {
      setValidationError("First and last name are required.");
      return;
    }

    setValidationError(null);
    await updateMutation.mutateAsync({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      phone: trimmedPhone.length > 0 ? trimmedPhone : null,
    });
  };

  const handleChangePassword = (): void => {
    void authService.resetPasswordForEmail(user.email);
    Alert.alert("Check your email", `We've sent a password reset link to ${user.email}.`);
  };

  const handleSignOut = (): void => {
    void forceClientSignOut();
  };

  const handleSignOutEverywhere = (): void => {
    Alert.alert(
      "Sign out everywhere",
      "This signs you out on every device and browser. You'll need to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out everywhere",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await authService.signOutEverywhere();
              resetClientSessionState();
            })();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>SETTINGS</Text>
          <Text style={styles.title}>Profile</Text>
        </View>

        <SettingsSection title="Personal info" icon="person-outline" accent="#185FA5">
          <SettingRow icon="image-outline" label="Profile photo" description="Upload a profile picture." comingSoon />

          <View style={styles.formBlock}>
            <ProfileField label="First name" onChangeText={setFirstName} placeholder="First name" value={firstName} />
            <ProfileField label="Last name" onChangeText={setLastName} placeholder="Last name" value={lastName} />
            <ProfileField
              keyboardType="phone-pad"
              label="Phone (optional)"
              onChangeText={setPhone}
              placeholder="Phone number"
              value={phone}
            />

            {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
            {updateMutation.isError ? (
              <Text style={styles.errorText}>
                {getApiErrorMessage(updateMutation.error) ?? "Could not update profile."}
              </Text>
            ) : null}
            {updateMutation.isSuccess && !isDirty ? <Text style={styles.successText}>Saved.</Text> : null}

            <Button
              disabled={!canSave}
              label="Save changes"
              loading={updateMutation.isPending}
              onPress={() => {
                void saveProfile();
              }}
            />
          </View>

          <View style={styles.emailBlock}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.emailValue}>{user.email}</Text>
            <Text style={styles.emailNote}>
              ⓘ Email is read-only — it&apos;s managed by Supabase Auth and can&apos;t be changed here.
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Security" icon="shield-checkmark-outline" accent="#854F0B">
          <SettingRow
            description="Sends a reset link to your email."
            icon="key-outline"
            label="Change password"
            onPress={handleChangePassword}
            showChevron
          />
          <SettingRow comingSoon icon="lock-closed-outline" label="Two-factor authentication" />
        </SettingsSection>

        <SettingsSection
          accent="#0F6E56"
          description="Notification preferences are coming soon."
          icon="notifications-outline"
          title="Notifications"
        >
          <SettingRow comingSoon icon="cash-outline" label="Payment received" />
          <SettingRow comingSoon icon="alert-circle-outline" label="Overdue period alert" />
          <SettingRow comingSoon icon="mail-outline" label="Email digest frequency" />
        </SettingsSection>

        <SettingsSection accent="#A32D2D" icon="phone-portrait-outline" title="Sessions">
          <SettingRow icon="log-out-outline" label="Sign out this device" onPress={handleSignOut} showChevron />
          <SettingRow
            danger
            description="Sign out on all devices and browsers."
            icon="log-out-outline"
            label="Sign out everywhere"
            onPress={handleSignOutEverywhere}
            showChevron
          />
          <SettingRow comingSoon icon="list-outline" label="Active sessions" />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

type ProfileFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
};

function ProfileField({ label, value, onChangeText, placeholder, keyboardType = "default" }: ProfileFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === "phone-pad" ? "none" : "words"}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  headerText: {
    gap: 2,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.action,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  formBlock: {
    gap: 10,
    paddingVertical: 6,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textLabel,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.textPrimary,
  },
  emailBlock: {
    gap: 4,
    paddingVertical: 6,
  },
  emailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emailNote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerFg,
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.action,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateCard: {
    alignSelf: "stretch",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
  },
  stateBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
