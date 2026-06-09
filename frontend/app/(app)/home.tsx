import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { HomeWelcome } from "@/src/features/organizations/components/HomeWelcome";
import { OrgSelectorCard } from "@/src/features/organizations/components/OrgSelectorCard";
import { useHomeScreenState } from "@/src/features/organizations/hooks/useHomeScreenState";
import { ProfileCompletionModal } from "@/src/features/users/components/ProfileCompletionModal";
import { Avatar } from "@/src/shared/components/ui/Avatar";
import { Card } from "@/src/shared/components/ui/Card";
import { forceClientSignOut } from "@/src/lib/forceClientSignOut";
import { colors, spacing } from "@/src/shared/theme/tokens";

export default function HomeScreen() {
  const {
    currentUser,
    memberships,
    selectedOrgId,
    isLoading,
    shouldShowProfileCompletion,
    shouldShowWelcome,
    shouldShowOrgSelector,
    errorMessage,
    onProfileCompleted,
    onSelectOrg,
    onCreateOrganization,
  } = useHomeScreenState();

  const fullName = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ").trim();
  const greetingName = currentUser?.firstName?.trim() || "there";

  const handleSignOut = (): void => {
    // Sign out only; SIGNED_OUT clears state and the route guards navigate to login.
    void forceClientSignOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>TUITIONIQ</Text>
            <Text style={styles.greeting}>Hi, {greetingName}</Text>
          </View>
          <Avatar name={fullName || currentUser?.email} size={44} />
        </View>

        {isLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.mutedText}>Loading your workspace...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Could not load your workspace</Text>
            <Text style={styles.warningBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {shouldShowWelcome ? <HomeWelcome onCreateOrganization={onCreateOrganization} /> : null}

        {shouldShowOrgSelector ? (
          <Card>
            <Text style={styles.sectionTitle}>Choose your organisation</Text>
            <Text style={styles.sectionBody}>Select where you want to work.</Text>
            <View style={styles.list}>
              {memberships.map((membership) => (
                <OrgSelectorCard
                  key={`${membership.organizationId}:${membership.role}`}
                  membership={membership}
                  selected={membership.organizationId === selectedOrgId}
                  onPress={() => onSelectOrg(membership)}
                />
              ))}
            </View>
          </Card>
        ) : null}

        {!isLoading ? (
          <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.signOut}>
            <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ProfileCompletionModal
        initialFirstName={currentUser?.firstName ?? ""}
        initialLastName={currentUser?.lastName ?? ""}
        initialPhone={currentUser?.phone ?? null}
        onCompleted={onProfileCompleted}
        visible={shouldShowProfileCompletion}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  greeting: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  centerBlock: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
  },
  mutedText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  warningCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF1F2",
    padding: spacing.md,
    gap: 6,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9F1239",
  },
  warningBody: {
    fontSize: 13,
    color: "#BE123C",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
