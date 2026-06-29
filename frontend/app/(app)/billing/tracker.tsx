import { Ionicons } from "@expo/vector-icons";
import type { StudentSummaryDto } from "@tuitioniq/types";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { PaymentTimeline } from "@/src/features/billing/components/PaymentTimeline";
import { useFeePeriods } from "@/src/features/billing/hooks/useFeePeriods";
import { StudentPicker } from "@/src/features/students/components/StudentPicker";
import { Avatar } from "@/src/shared/components/ui/Avatar";
import { Button } from "@/src/shared/components/ui/Button";
import { Card } from "@/src/shared/components/ui/Card";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { resolveRouteParam } from "@/src/shared/utils/resolveRouteParam";
import { colors, spacing } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";

export default function PaymentTrackerScreen() {
  const router = useRouter();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const params = useLocalSearchParams<{ studentId?: string | string[]; studentName?: string | string[] }>();
  const routeStudentId = useMemo(() => resolveRouteParam(params.studentId), [params.studentId]);
  const routeStudentName = useMemo(() => resolveRouteParam(params.studentName), [params.studentName]);

  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(
    routeStudentId ? { id: routeStudentId, name: routeStudentName ?? "Selected student" } : null,
  );

  useEffect(() => {
    if (routeStudentId) {
      setSelectedStudent({ id: routeStudentId, name: routeStudentName ?? "Selected student" });
    }
  }, [routeStudentId, routeStudentName]);

  const feePeriodsQuery = useFeePeriods(selectedStudent?.id ?? null);

  const handleSelect = (student: StudentSummaryDto): void => {
    setSelectedStudent({
      id: student.id,
      name: [student.firstName, student.lastName].filter(Boolean).join(" ").trim() || "Selected student",
    });
  };

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Payment Tracker</Text>
          <Text style={styles.stateBody}>Select an organisation first from Home.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>BILLING</Text>
          <Text style={styles.title}>Payment Tracker</Text>
          <Text style={styles.subtitle}>
            Monitor each student&apos;s monthly fees from enrolment and spot outstanding months.
          </Text>
        </View>

        {!selectedStudent ? (
          <Card>
            <StudentPicker
              orgId={selectedOrgId}
              onSelect={handleSelect}
              selectedStudentId={null}
            />
          </Card>
        ) : (
          <>
            <Card>
              <View style={styles.selectedRow}>
                <Avatar name={selectedStudent.name} size={40} />
                <View style={styles.selectedText}>
                  <Text style={styles.selectedLabel}>Tracking</Text>
                  <Text numberOfLines={1} style={styles.selectedName}>
                    {selectedStudent.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setSelectedStudent(null)}
                  style={styles.changeButton}
                >
                  <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
                  <Text style={styles.changeButtonText}>Change</Text>
                </Pressable>
              </View>

              <Button
                label="Record a payment for this student"
                onPress={() =>
                  router.push({
                    pathname: "/billing/record",
                    params: { studentId: selectedStudent.id, studentName: selectedStudent.name },
                  } as Href)
                }
                variant="action"
              />
            </Card>

            {feePeriodsQuery.isPending ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.stateBody}>Loading payment history…</Text>
              </View>
            ) : null}

            {feePeriodsQuery.isError ? (
              <View style={styles.centerState}>
                <Text style={styles.stateTitle}>Could not load payment history</Text>
                <Text style={styles.stateBody}>
                  {getApiErrorMessage(feePeriodsQuery.error) ?? "Please try again."}
                </Text>
              </View>
            ) : null}

            {feePeriodsQuery.data && feePeriodsQuery.data.length === 0 ? (
              <Card>
                <Text style={styles.sectionTitle}>No schedule yet</Text>
                <Text style={styles.stateBody}>
                  This student has no monthly fee periods. Set a fee to generate their schedule from
                  the enrolment date.
                </Text>
                <Button
                  label="Set a fee for this student"
                  onPress={() =>
                    router.push(
                      `/(app)/(teacher)/students/${selectedStudent.id}/periods` as Href,
                    )
                  }
                  variant="action"
                />
              </Card>
            ) : null}

            {feePeriodsQuery.data && feePeriodsQuery.data.length > 0 ? (
              <Card>
                <Text style={styles.sectionTitle}>Monthly history</Text>
                <PaymentTimeline
                  onSelectPeriod={(period) =>
                    router.push({
                      pathname: "/(app)/(teacher)/students/[studentId]/payments",
                      params: { studentId: selectedStudent.id, periodId: period.id },
                    } as Href)
                  }
                  periods={feePeriodsQuery.data}
                />
              </Card>
            ) : null}
          </>
        )}
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
    gap: 4,
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
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  selectedText: {
    flex: 1,
    gap: 2,
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  selectedName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  changeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  centerState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  stateContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
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
