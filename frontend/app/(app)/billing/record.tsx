import { Ionicons } from "@expo/vector-icons";
import type { FeePeriodDto, RecordPaymentRequest, StudentSummaryDto } from "@tuitioniq/types";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { WaivePeriodForm } from "@/src/features/billing/components/WaivePeriodForm";
import { useFeeHistory } from "@/src/features/billing/hooks/useFeeHistory";
import { useFeePeriods, useWaivePeriod } from "@/src/features/billing/hooks/useFeePeriods";
import { useRecordPayments } from "@/src/features/billing/hooks/useRecordPayments";
import { isOutstandingStatus, periodMonthLabel, periodMonthShortLabel } from "@/src/features/billing/utils/feeStatus";
import { StudentPicker } from "@/src/features/students/components/StudentPicker";
import { Avatar } from "@/src/shared/components/ui/Avatar";
import { Button } from "@/src/shared/components/ui/Button";
import { Card } from "@/src/shared/components/ui/Card";
import { PaymentStatusBadge } from "@/src/shared/components/ui/PaymentStatusBadge";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { formatCurrency } from "@/src/shared/utils/formatCurrency";
import { resolveRouteParam } from "@/src/shared/utils/resolveRouteParam";
import { colors, radius, spacing } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";

const PAYMENT_METHODS = ["Cash", "BankTransfer", "Card", "Cheque", "Other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Use UTC parts so the default/validation match the backend, which treats "today"
// as DateOnly.FromDateTime(DateTime.UtcNow). Using the device's local date would
// otherwise be rejected as "in the future" in timezones ahead of UTC (e.g. UTC+6).
function toDateOnlyString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return candidate;
}

type SelectedStudent = { id: string; name: string };

export default function PaymentSubmissionScreen() {
  const router = useRouter();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const params = useLocalSearchParams<{
    studentId?: string | string[];
    studentName?: string | string[];
    periodId?: string | string[];
  }>();
  const routeStudentId = useMemo(() => resolveRouteParam(params.studentId), [params.studentId]);
  const routeStudentName = useMemo(() => resolveRouteParam(params.studentName), [params.studentName]);
  const routePeriodId = useMemo(() => resolveRouteParam(params.periodId), [params.periodId]);

  const [student, setStudent] = useState<SelectedStudent | null>(
    routeStudentId ? { id: routeStudentId, name: routeStudentName ?? "Selected student" } : null,
  );

  useEffect(() => {
    if (routeStudentId) {
      setStudent({ id: routeStudentId, name: routeStudentName ?? "Selected student" });
    }
  }, [routeStudentId, routeStudentName]);

  const feePeriodsQuery = useFeePeriods(student?.id ?? null);
  const feeHistoryQuery = useFeeHistory(student?.id ?? null);
  const recordPayments = useRecordPayments(student?.id ?? null);
  const waivePeriod = useWaivePeriod(student?.id ?? null);

  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([]);
  const [waivingPeriod, setWaivingPeriod] = useState<FeePeriodDto | null>(null);
  const [amountText, setAmountText] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paymentDate, setPaymentDate] = useState(toDateOnlyString(new Date()));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Payable months: those that still carry a balance (unpaid / partial / overdue).
  const payablePeriods = useMemo(
    () => (feePeriodsQuery.data ?? []).filter((period) => isOutstandingStatus(period.status)),
    [feePeriodsQuery.data],
  );

  const currency = feePeriodsQuery.data?.[0]?.currency ?? "BDT";
  const hasPeriods = (feePeriodsQuery.data?.length ?? 0) > 0;
  const activeFee = feeHistoryQuery.data?.find((fee) => fee.isActive) ?? null;

  // The current calendar month's period drives the at-a-glance checker.
  const nowDate = new Date();
  const currentYear = nowDate.getFullYear();
  const currentMonth = nowDate.getMonth() + 1;
  const currentPeriod = useMemo(
    () =>
      (feePeriodsQuery.data ?? []).find(
        (period) => period.periodYear === currentYear && period.periodMonth === currentMonth,
      ) ?? null,
    [feePeriodsQuery.data, currentYear, currentMonth],
  );

  const isScheduleReady = !feePeriodsQuery.isPending && !feePeriodsQuery.isError && hasPeriods;

  // When arriving from a specific period (e.g. the billing detail screen), preselect
  // that month for payment once its data is available and it is still outstanding.
  const appliedPeriodRef = useRef<string | null>(null);
  useEffect(() => {
    if (!routePeriodId || !feePeriodsQuery.data) {
      return;
    }
    if (appliedPeriodRef.current === routePeriodId) {
      return;
    }
    const target = feePeriodsQuery.data.find((period) => period.id === routePeriodId);
    if (target && isOutstandingStatus(target.status)) {
      setSelectedPeriodIds([routePeriodId]);
      appliedPeriodRef.current = routePeriodId;
    }
  }, [routePeriodId, feePeriodsQuery.data]);

  const resetStudent = (next: SelectedStudent | null): void => {
    setStudent(next);
    setSelectedPeriodIds([]);
    setWaivingPeriod(null);
    setValidationError(null);
    setResultMessage(null);
    appliedPeriodRef.current = null;
    recordPayments.reset();
    waivePeriod.reset();
  };

  const submitWaive = async (waiverReason: string): Promise<void> => {
    if (!waivingPeriod) {
      return;
    }

    await waivePeriod.mutateAsync({ periodId: waivingPeriod.id, body: { waiverReason } });
    setWaivingPeriod(null);
  };

  const togglePeriod = (periodId: string): void => {
    setResultMessage(null);
    setSelectedPeriodIds((current) =>
      current.includes(periodId)
        ? current.filter((id) => id !== periodId)
        : [...current, periodId],
    );
  };

  const amountValue = Number(amountText.trim());
  const selectedCount = selectedPeriodIds.length;
  const totalToCollect = Number.isFinite(amountValue) && amountValue > 0 ? amountValue * selectedCount : 0;

  const submit = async (): Promise<void> => {
    if (!student) {
      return;
    }

    if (selectedPeriodIds.length === 0) {
      setValidationError("Select at least one month to record a payment for.");
      return;
    }

    const normalizedAmount = amountText.trim();
    if (!/^\d+$/.test(normalizedAmount) || Number(normalizedAmount) <= 0) {
      setValidationError("Amount must be a whole number greater than 0.");
      return;
    }

    const parsedDate = parseDateOnly(paymentDate);
    if (!parsedDate) {
      setValidationError("Payment date must be in YYYY-MM-DD format.");
      return;
    }
    const today = parseDateOnly(toDateOnlyString(new Date()));
    if (today && parsedDate.getTime() > today.getTime()) {
      setValidationError("Payment date cannot be in the future.");
      return;
    }

    setValidationError(null);
    setResultMessage(null);

    const amount = Number(normalizedAmount);
    const requests: RecordPaymentRequest[] = selectedPeriodIds.map((feePeriodId) => ({
      studentId: student.id,
      feePeriodId,
      amount,
      currency: currency.trim().toUpperCase(),
      paymentDate: paymentDate.trim(),
      paymentMethod,
      reference: reference.trim().length > 0 ? reference.trim() : null,
      notes: notes.trim().length > 0 ? notes.trim() : null,
    }));

    const results = await recordPayments.mutateAsync(requests);
    const succeeded = results.filter((result) => result.ok).length;
    const failed = results.length - succeeded;

    if (failed === 0) {
      setResultMessage(`Recorded ${succeeded} payment${succeeded === 1 ? "" : "s"} of ${formatCurrency(amount, currency)} each.`);
      setSelectedPeriodIds([]);
      setAmountText("");
      setReference("");
      setNotes("");
    } else {
      setResultMessage(`Recorded ${succeeded} of ${results.length}. ${failed} month${failed === 1 ? "" : "s"} failed — please retry those.`);
      setSelectedPeriodIds(results.filter((result) => !result.ok).map((result) => result.feePeriodId));
    }
  };

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Record Payment</Text>
          <Text style={styles.stateBody}>Select an organisation first from Home.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerText}>
          <Text style={styles.kicker}>BILLING</Text>
          <Text style={styles.title}>Record Payment</Text>
          <Text style={styles.subtitle}>
            Log a cash (or other) payment against one or more outstanding months.
          </Text>
        </View>

        {!student ? (
          <Card>
            <StudentPicker orgId={selectedOrgId} onSelect={(value: StudentSummaryDto) =>
              resetStudent({
                id: value.id,
                name: [value.firstName, value.lastName].filter(Boolean).join(" ").trim() || "Selected student",
              })
            } selectedStudentId={null} />
          </Card>
        ) : (
          <>
            <Card>
              <View style={styles.selectedRow}>
                <Avatar name={student.name} size={40} />
                <View style={styles.selectedText}>
                  <Text style={styles.selectedLabel}>Paying for</Text>
                  <Text numberOfLines={1} style={styles.selectedName}>{student.name}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => resetStudent(null)}
                  style={styles.changeButton}
                >
                  <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
                  <Text style={styles.changeButtonText}>Change</Text>
                </Pressable>
              </View>
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Outstanding months</Text>
              <Text style={styles.sectionHint}>
                Tick the months to pay. The amount below is recorded for each ticked month.
              </Text>

              {feePeriodsQuery.isPending ? (
                <View style={styles.inlineState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.stateBody}>Checking payment schedule…</Text>
                </View>
              ) : null}

              {feePeriodsQuery.isError ? (
                <Text style={styles.errorText}>
                  {getApiErrorMessage(feePeriodsQuery.error) ?? "Could not load fee periods."}
                </Text>
              ) : null}

              {/* Current-month checker: surfaces this month's status at a glance. */}
              {isScheduleReady ? (
                <View style={styles.checkerRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.checkerText}>
                    {periodMonthLabel(currentYear, currentMonth)} (current month)
                  </Text>
                  {currentPeriod ? (
                    <PaymentStatusBadge status={currentPeriod.status} />
                  ) : (
                    <Text style={styles.checkerMuted}>not scheduled</Text>
                  )}
                </View>
              ) : null}

              {/* No schedule yet — guide the admin to set a fee, which generates the months. */}
              {!feePeriodsQuery.isPending && !feePeriodsQuery.isError && !hasPeriods ? (
                <View style={styles.noScheduleWrap}>
                  <Text style={styles.stateBody}>
                    {activeFee
                      ? "A fee is set but no monthly periods exist yet. Re-save the fee to generate the schedule, then return here."
                      : "No fee has been set for this student, so there are no months to pay yet. Set a monthly fee to start their schedule from the enrolment date."}
                  </Text>
                  <Button
                    label={activeFee ? "Review fee & periods" : "Set a fee for this student"}
                    onPress={() =>
                      router.push(`/(app)/(teacher)/students/${student.id}/periods` as Href)
                    }
                    variant="action"
                  />
                </View>
              ) : null}

              {/* Schedule exists and everything is settled. */}
              {isScheduleReady && payablePeriods.length === 0 ? (
                <View style={styles.inlineState}>
                  <Text style={styles.stateBody}>
                    All months from enrolment to {periodMonthLabel(currentYear, currentMonth)} are paid up.
                  </Text>
                </View>
              ) : null}

              {payablePeriods.length > 0 ? (
                <View style={styles.monthList}>
                  {payablePeriods.map((period: FeePeriodDto) => {
                    const isSelected = selectedPeriodIds.includes(period.id);
                    const isCurrent =
                      period.periodYear === currentYear && period.periodMonth === currentMonth;
                    const balance = Math.max(period.fee - period.amountPaid, 0);
                    return (
                      <View
                        key={period.id}
                        style={[styles.monthRow, isSelected && styles.monthRowSelected]}
                      >
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          onPress={() => togglePeriod(period.id)}
                          style={styles.monthSelectArea}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? colors.primary : colors.textMuted}
                          />
                          <View style={styles.monthInfo}>
                            <Text style={styles.monthName}>
                              {periodMonthShortLabel(period.periodYear, period.periodMonth)}
                              {isCurrent ? <Text style={styles.currentTag}>  • current</Text> : null}
                            </Text>
                            <Text style={styles.monthBalance}>
                              {formatCurrency(balance, period.currency)} due
                            </Text>
                          </View>
                        </Pressable>

                        <View style={styles.monthRight}>
                          <PaymentStatusBadge status={period.status} />
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              setSelectedPeriodIds((current) =>
                                current.filter((id) => id !== period.id),
                              );
                              setResultMessage(null);
                              setWaivingPeriod(period);
                            }}
                            style={styles.waiveLink}
                          >
                            <Text style={styles.waiveLinkText}>Waive</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </Card>

            {waivingPeriod ? (
              <Card>
                <Text style={styles.sectionTitle}>
                  Waive {periodMonthLabel(waivingPeriod.periodYear, waivingPeriod.periodMonth)}
                </Text>
                <WaivePeriodForm
                  errorMessage={
                    waivePeriod.isError
                      ? (getApiErrorMessage(waivePeriod.error) ?? "Could not waive period.")
                      : null
                  }
                  isSubmitting={waivePeriod.isPending}
                  onCancel={() => setWaivingPeriod(null)}
                  onSubmit={submitWaive}
                  periodLabel={periodMonthShortLabel(waivingPeriod.periodYear, waivingPeriod.periodMonth)}
                />
              </Card>
            ) : null}

            {payablePeriods.length > 0 ? (
            <Card>
              <Text style={styles.sectionTitle}>Payment details</Text>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Amount per month ({currency})</Text>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    setAmountText(value);
                    setResultMessage(null);
                  }}
                  placeholder="e.g. 1500"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={amountText}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Payment method</Text>
                <View style={styles.methodRow}>
                  {PAYMENT_METHODS.map((method) => {
                    const isActive = paymentMethod === method;
                    return (
                      <Pressable
                        key={method}
                        onPress={() => setPaymentMethod(method)}
                        style={[styles.methodChip, isActive && styles.methodChipActive]}
                      >
                        <Text style={[styles.methodText, isActive && styles.methodTextActive]}>{method}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Payment date (YYYY-MM-DD)</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setPaymentDate}
                  placeholder="2026-06-30"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={paymentDate}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Reference (optional)</Text>
                <TextInput
                  onChangeText={setReference}
                  placeholder="Receipt or transaction id"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={reference}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  multiline
                  numberOfLines={3}
                  onChangeText={setNotes}
                  placeholder="Any context for this payment"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.textArea]}
                  value={notes}
                />
              </View>

              {selectedCount > 0 && totalToCollect > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {selectedCount} month{selectedCount === 1 ? "" : "s"} × {formatCurrency(amountValue, currency)}
                  </Text>
                  <Text style={styles.totalValue}>{formatCurrency(totalToCollect, currency)}</Text>
                </View>
              ) : null}

              {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
              {recordPayments.isError ? (
                <Text style={styles.errorText}>
                  {getApiErrorMessage(recordPayments.error) ?? "Could not record payment."}
                </Text>
              ) : null}
              {resultMessage ? <Text style={styles.successText}>{resultMessage}</Text> : null}

              <Button
                disabled={selectedCount === 0}
                label={
                  selectedCount > 1 ? `Record ${selectedCount} payments` : "Record payment"
                }
                loading={recordPayments.isPending}
                onPress={() => {
                  void submit();
                }}
              />
            </Card>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/billing/tracker",
                  params: { studentId: student.id, studentName: student.name },
                } as Href)
              }
              style={styles.linkRow}
            >
              <Ionicons name="grid-outline" size={16} color={colors.primary} />
              <Text style={styles.linkText}>View this student&apos;s payment tracker</Text>
            </Pressable>
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
  sectionHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
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
  checkerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  checkerMuted: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  noScheduleWrap: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  currentTag: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  monthList: {
    gap: spacing.sm,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  monthRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.avatarBg,
  },
  monthSelectArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  monthRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  monthInfo: {
    flex: 1,
    gap: 2,
  },
  waiveLink: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  waiveLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.warningFg,
  },
  monthName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  monthBalance: {
    fontSize: 12,
    color: colors.textMuted,
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textLabel,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  methodChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  methodChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.avatarBg,
  },
  methodText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  methodTextActive: {
    color: colors.primary,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  totalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  inlineState: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerFg,
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.successFg,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
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
