import { ProfileCompletionModal } from "@/src/features/users/components/ProfileCompletionModal";
import { useHomeScreenState } from "@/src/features/organizations/hooks/useHomeScreenState";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const {
    currentUser,
    memberships,
    isLoading,
    shouldShowProfileCompletion,
    shouldShowWelcome,
    shouldShowOrgSelector,
    errorMessage,
    onProfileCompleted,
    onSelectOrg,
  } = useHomeScreenState();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.kicker}>TuitionIQ</Text>
        <Text style={styles.heading}>Home</Text>

        {isLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.bodyText}>Loading your workspace...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Could not load your workspace</Text>
            <Text style={styles.warningBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {shouldShowWelcome ? (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>Welcome to TuitionIQ</Text>
            <Text style={styles.welcomeBody}>
              Create your organisation to start managing students and fee periods.
            </Text>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Create your organisation</Text>
            </Pressable>
          </View>
        ) : null}

        {shouldShowOrgSelector ? (
          <View style={styles.selectorCard}>
            <Text style={styles.selectorTitle}>Select organisation</Text>
            <Text style={styles.selectorBody}>
              Choose where you want to continue as {currentUser?.email ?? "teacher"}.
            </Text>
            <View style={styles.membershipList}>
              {memberships.map((membership) => (
                <Pressable
                  key={`${membership.organizationId}:${membership.role}`}
                  onPress={() => onSelectOrg(membership)}
                  style={styles.membershipItem}
                >
                  <View style={styles.membershipTextWrap}>
                    <Text style={styles.membershipName}>{membership.organization.name}</Text>
                    <Text style={styles.membershipMeta}>
                      {membership.role} · {membership.organization.plan}
                    </Text>
                  </View>
                  <Text style={styles.membershipArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </View>
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
    backgroundColor: "#f1f5f9",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: "#0d9488",
    textTransform: "uppercase",
  },
  heading: {
    fontSize: 30,
    fontWeight: "700",
    color: "#0f172a",
  },
  centerBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  bodyText: {
    fontSize: 14,
    color: "#475569",
  },
  warningCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    padding: 14,
    gap: 6,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9f1239",
  },
  warningBody: {
    fontSize: 13,
    color: "#be123c",
  },
  welcomeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 10,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  welcomeBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: "#1d4ed8",
    minHeight: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  selectorCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 10,
  },
  selectorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  selectorBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },
  membershipList: {
    gap: 8,
  },
  membershipItem: {
    backgroundColor: "#f8fafc",
    borderColor: "#dbe5ef",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  membershipTextWrap: {
    gap: 3,
  },
  membershipName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  membershipMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  membershipArrow: {
    fontSize: 18,
    color: "#1d4ed8",
  },
});
