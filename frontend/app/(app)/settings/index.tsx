import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { OrgSettingsForm } from "@/src/features/organizations/components/OrgSettingsForm";
import { organizationsApiClient } from "@/src/features/organizations/services/organizationsApiClient";
import { SettingRow } from "@/src/shared/components/ui/SettingRow";
import { SettingsSection } from "@/src/shared/components/ui/SettingsSection";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { colors, spacing } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";

const organizationDetailsQueryKey = (organizationId: string | null) =>
  ["organizations", "detail", organizationId] as const;

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export default function OrganisationSettingsScreen() {
  const router = useRouter();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const organizationQuery = useQuery({
    queryKey: organizationDetailsQueryKey(selectedOrgId),
    queryFn: () => organizationsApiClient.getOrg(selectedOrgId!),
    enabled: Boolean(selectedOrgId),
  });

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Organisation settings</Text>
          <Text style={styles.stateBody}>Select an organisation first from Home.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/home" as Href)}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>Go to organisations</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (organizationQuery.isPending) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.stateBody}>Loading organisation...</Text>
      </SafeAreaView>
    );
  }

  if (organizationQuery.isError || !organizationQuery.data) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Could not load organisation</Text>
          <Text style={styles.stateBody}>
            {getApiErrorMessage(organizationQuery.error) ?? "Please try again."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const organization = organizationQuery.data;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>SETTINGS</Text>
          <Text style={styles.title}>Organisation settings</Text>
        </View>

        <SettingsSection title="Organisation" icon="business-outline">
          <OrgSettingsForm organizationId={organization.id} currentName={organization.name} />
          <SettingRow label="Slug" right={<Text style={styles.metaValue}>{organization.slug}</Text>} />
          <SettingRow label="Plan" right={<Text style={styles.metaValue}>{organization.plan}</Text>} />
          <SettingRow label="Created" right={<Text style={styles.metaValue}>{formatDate(organization.createdAt)}</Text>} />
        </SettingsSection>

        <SettingsSection
          title="Team"
          icon="people-outline"
          accent={colors.textMuted}
          description="Member management and team invites are coming soon."
        >
          <SettingRow icon="person-outline" label="Members" comingSoon />
          <SettingRow icon="mail-outline" label="Invite team members" comingSoon />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
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
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
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
  linkButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});
