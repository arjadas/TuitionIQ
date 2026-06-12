import { useQueryClient } from "@tanstack/react-query";
import type { FeePaymentDto, RecordPaymentRequest } from "@tuitioniq/types";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FeePeriodCard } from "@/src/features/billing/components/FeePeriodCard";
import { RecordPaymentForm } from "@/src/features/billing/components/RecordPaymentForm";
import { WaivePeriodForm } from "@/src/features/billing/components/WaivePeriodForm";
import { useRecordPayment, useReversePayment, useWaivePeriod } from "@/src/features/billing/hooks/useFeePeriods";
import { useOrgPeriod } from "@/src/features/billing/hooks/useOrgPeriod";
import { usePayments } from "@/src/features/billing/hooks/usePayments";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { formatCurrency } from "@/src/shared/utils/formatCurrency";
import { resolveRouteParam } from "@/src/shared/utils/resolveRouteParam";
import { colors, radius, spacing } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";

const WAIVABLE_STATUSES = ["unpaid", "partial", "overdue"];

function formatDate(value: string): string {
  const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (dateOnlyPattern.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function buildPaymentMeta(payment: FeePaymentDto): string {
  const parts = [payment.paymentMethod, formatDate(payment.paymentDate)];
  if (payment.reference && payment.reference.trim().length > 0) {
    parts.push(`Ref: ${payment.reference}`);
  }

  return parts.join(" · ");
}

export default function FeePeriodDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ periodId?: string | string[] }>();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const periodId = useMemo(() => resolveRouteParam(params.periodId), [params.periodId]);

  const periodQuery = useOrgPeriod(periodId);
  const studentId = periodQuery.data?.studentId ?? null;

  const paymentsQuery = usePayments(periodId, studentId);
  const recordPaymentMutation = useRecordPayment(studentId);
  const reversePaymentMutation = useReversePayment(studentId);
  const waivePeriodMutation = useWaivePeriod(studentId);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showWaiveForm, setShowWaiveForm] = useState(false);

  const refreshOrgBilling = async (): Promise<void> => {
    await periodQuery.refetch();
    if (selectedOrgId) {
      await queryClient.invalidateQueries({ queryKey: ["billing", "org-periods", selectedOrgId] });
    }
  };

  const submitRecordPayment = async (body: RecordPaymentRequest): Promise<void> => {
    await recordPaymentMutation.mutateAsync(body);
    setShowRecordForm(false);
    await refreshOrgBilling();
  };

  const submitWaive = async (waiverReason: string): Promise<void> => {
    if (!periodId) {
      return;
    }

    await waivePeriodMutation.mutateAsync({ periodId, body: { waiverReason } });
    setShowWaiveForm(false);
    await refreshOrgBilling();
  };

  const confirmReverse = (paymentId: string): void => {
    if (!periodId) {
      return;
    }

    Alert.alert("Reverse payment", "This soft-deletes the payment and recalculates the period totals.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reverse",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await reversePaymentMutation.mutateAsync({ paymentId, feePeriodId: periodId });
            await refreshOrgBilling();
          })();
        },
      },
    ]);
  };

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Fee period</Text>
          <Text style={styles.stateBody}>Select an organisation first from Home.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (periodQuery.isPending) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.stateBody}>Loading fee period...</Text>
      </SafeAreaView>
    );
  }

  if (periodQuery.isError || !periodQuery.data) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Could not load fee period</Text>
          <Text style={styles.stateBody}>{getApiErrorMessage(periodQuery.error) ?? "Please try again."}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/billing" as Href)} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Back to billing</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const period = periodQuery.data;
  const periodLabel = `${period.periodYear}-${String(period.periodMonth).padStart(2, "0")}`;
  const canWaive = WAIVABLE_STATUSES.includes(period.status.trim().toLowerCase());

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>BILLING</Text>
            <Text style={styles.title}>{period.studentName}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push("/billing" as Href)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>All periods</Text>
          </Pressable>
        </View>

        <FeePeriodCard period={period} selected />

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setShowRecordForm((open) => !open);
              setShowWaiveForm(false);
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{showRecordForm ? "Close" : "Record payment"}</Text>
          </Pressable>
          {canWaive ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setShowWaiveForm((open) => !open);
                setShowRecordForm(false);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{showWaiveForm ? "Close" : "Waive"}</Text>
            </Pressable>
          ) : null}
        </View>

        {showRecordForm && studentId ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Record payment</Text>
            <RecordPaymentForm
              currency={period.currency}
              errorMessage={
                recordPaymentMutation.isError
                  ? (getApiErrorMessage(recordPaymentMutation.error) ?? "Could not record payment.")
                  : null
              }
              feePeriodId={period.id}
              isSubmitting={recordPaymentMutation.isPending}
              onCancel={() => setShowRecordForm(false)}
              onSubmit={submitRecordPayment}
              studentId={studentId}
            />
          </View>
        ) : null}

        {showWaiveForm ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Waive period</Text>
            <WaivePeriodForm
              errorMessage={
                waivePeriodMutation.isError
                  ? (getApiErrorMessage(waivePeriodMutation.error) ?? "Could not waive period.")
                  : null
              }
              isSubmitting={waivePeriodMutation.isPending}
              onCancel={() => setShowWaiveForm(false)}
              onSubmit={submitWaive}
              periodLabel={periodLabel}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payments</Text>

          {paymentsQuery.isPending ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateBody}>Loading payments...</Text>
            </View>
          ) : null}

          {paymentsQuery.isError ? (
            <Text style={styles.errorText}>{getApiErrorMessage(paymentsQuery.error) ?? "Could not load payments."}</Text>
          ) : null}

          {!paymentsQuery.isPending && !paymentsQuery.isError && (paymentsQuery.data?.length ?? 0) === 0 ? (
            <View style={styles.inlineState}>
              <Text style={styles.stateBody}>No payments recorded for this period yet.</Text>
            </View>
          ) : null}

          {!paymentsQuery.isPending && !paymentsQuery.isError && paymentsQuery.data ? (
            <View style={styles.paymentList}>
              {paymentsQuery.data.map((payment) => (
                <View key={payment.id} style={styles.paymentItem}>
                  <View style={styles.paymentTextWrap}>
                    <Text style={styles.paymentAmount}>{formatCurrency(payment.amount, payment.currency)}</Text>
                    <Text style={styles.paymentMeta}>{buildPaymentMeta(payment)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={reversePaymentMutation.isPending}
                    onPress={() => confirmReverse(payment.id)}
                    style={[styles.reverseButton, reversePaymentMutation.isPending && styles.disabledButton]}
                  >
                    <Text style={styles.reverseButtonText}>Reverse</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {reversePaymentMutation.isError ? (
            <Text style={styles.errorText}>
              {getApiErrorMessage(reversePaymentMutation.error) ?? "Could not reverse payment."}
            </Text>
          ) : null}
        </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.action,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  primaryButton: {
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minHeight: 42,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 14,
  },
  paymentList: {
    gap: 8,
  },
  paymentItem: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  paymentTextWrap: {
    flex: 1,
    gap: 3,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  paymentMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  reverseButton: {
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reverseButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  inlineState: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerFg,
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
