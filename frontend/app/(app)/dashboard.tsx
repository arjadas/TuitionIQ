import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useOrgMemberships } from "@/src/features/organizations/hooks/useOrgMemberships";
import { organizationsApiClient } from "@/src/features/organizations/services/organizationsApiClient";
import { OrgStudentsCard } from "@/src/features/students/components/OrgStudentsCard";
import { Avatar } from "@/src/shared/components/ui/Avatar";
import { Button } from "@/src/shared/components/ui/Button";
import { Card } from "@/src/shared/components/ui/Card";
import { RoleBadge } from "@/src/shared/components/ui/RoleBadge";
import { colors, spacing } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";

const organizationDetailsQueryKey = (organizationId: string | null) =>
  ["organizations", "detail", organizationId] as const;

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data;
    if (typeof responseData === "object" && responseData !== null) {
      const problemDetails = responseData as Record<string, unknown>;

      if (typeof problemDetails.detail === "string" && problemDetails.detail.trim().length > 0) {
        return problemDetails.detail;
      }

      if (typeof problemDetails.title === "string" && problemDetails.title.trim().length > 0) {
        return problemDetails.title;
      }
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function formatDate(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString();
}

export default function DashboardScreen() {
  const router = useRouter();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const membershipsQuery = useOrgMemberships();
  const memberships = useMemo(() => membershipsQuery.data ?? [], [membershipsQuery.data]);

  // Never auto-select. If no org has been chosen (e.g. native restart cleared the
  // in-memory selection), send the user back to the selector to pick one.
  useEffect(() => {
    if (membershipsQuery.isSuccess && !selectedOrgId) {
      router.replace("/home" as Href);
    }
  }, [membershipsQuery.isSuccess, router, selectedOrgId]);

  const selectedMembership = useMemo(() => {
    if (!selectedOrgId) {
      return null;
    }

    return memberships.find((membership) => membership.organizationId === selectedOrgId) ?? null;
  }, [memberships, selectedOrgId]);

  const organizationQuery = useQuery({
    queryKey: organizationDetailsQueryKey(selectedOrgId),
    queryFn: () => organizationsApiClient.getOrg(selectedOrgId!),
    enabled: Boolean(selectedOrgId),
  });

  const goToSelector = (): void => {
    router.replace("/home" as Href);
  };

  const isLoading = membershipsQuery.isPending || (Boolean(selectedOrgId) && organizationQuery.isPending);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.mutedText}>Loading organization...</Text>
      </SafeAreaView>
    );
  }

  if (membershipsQuery.isError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Card style={styles.fullWidthCard}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.errorText}>
            {getErrorMessage(membershipsQuery.error, "Could not load memberships.")}
          </Text>
        </Card>
      </SafeAreaView>
    );
  }

  if (!selectedOrgId || !organizationQuery.data || organizationQuery.isError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Card style={styles.fullWidthCard}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.mutedText}>
            {organizationQuery.isError
              ? getErrorMessage(organizationQuery.error, "Could not load organization details.")
              : "Choose an organisation to continue."}
          </Text>
          <Button label="Go to organisations" onPress={goToSelector} />
        </Card>
      </SafeAreaView>
    );
  }

  const organization = organizationQuery.data;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>DASHBOARD</Text>
            <Text style={styles.orgName} numberOfLines={1}>{organization.name}</Text>
            {selectedMembership ? <RoleBadge role={selectedMembership.role} /> : null}
          </View>
          <Avatar name={organization.name} size={48} />
        </View>

        <Card>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Plan</Text>
            <Text style={styles.metaValue}>{organization.plan}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Slug</Text>
            <Text style={styles.metaValue}>{organization.slug}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{formatDate(organization.createdAt)}</Text>
          </View>
        </Card>

        <OrgStudentsCard
          orgId={selectedOrgId}
          onAddStudent={() => {
            router.push("/(app)/(teacher)/students/new" as Href);
          }}
          onSeeAll={() => {
            router.push("/(app)/(teacher)/students" as Href);
          }}
          onSelectStudent={(studentId) => {
            router.push(`/(app)/(teacher)/students/${studentId}` as Href);
          }}
        />

        <Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/settings" as Href)}
            style={styles.linkRow}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Organisation settings</Text>
              <Text style={styles.linkBody}>Edit the organisation name, view plan and slug.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        <Pressable accessibilityRole="button" onPress={goToSelector} style={styles.switchOrg}>
          <Text style={styles.switchOrgText}>Switch organisation</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.action,
  },
  orgName: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  fullWidthCard: {
    alignSelf: "stretch",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  linkText: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  linkBody: {
    fontSize: 12,
    color: colors.textMuted,
  },
  mutedText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    color: "#B91C1C",
  },
  switchOrg: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  switchOrgText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});
