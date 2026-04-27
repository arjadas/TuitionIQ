import type { FeePaymentDto, FeePeriodDto, RecordPaymentRequest } from "@tuitioniq/types";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { useFeePeriods, useRecordPayment, useReversePayment } from "@/src/features/billing/hooks/useFeePeriods";
import { usePayments } from "@/src/features/billing/hooks/usePayments";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { formatCurrency } from "@/src/shared/utils/formatCurrency";
import { useOrgStore } from "@/src/store/orgStore";

function resolveParam(input: string | string[] | undefined): string | null {
  if (!input) {
    return null;
  }

  if (Array.isArray(input)) {
    return input[0] ?? null;
  }

  return input;
}

function formatDate(value: string): string {
  const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (dateOnlyPattern.test(value)) {
    return value;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString();
}

function buildPaymentMeta(payment: FeePaymentDto): string {
  const parts = [payment.paymentMethod, formatDate(payment.paymentDate)];
  if (payment.reference && payment.reference.trim().length > 0) {
    parts.push(`Ref: ${payment.reference}`);
  }

  return parts.join(" · ");
}

export default function StudentPaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string | string[]; periodId?: string | string[] }>();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const studentId = useMemo(() => resolveParam(params.studentId), [params.studentId]);
  const periodIdFromRoute = useMemo(() => resolveParam(params.periodId), [params.periodId]);

  const feePeriodsQuery = useFeePeriods(studentId);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periodIdFromRoute);
  const [showRecordForm, setShowRecordForm] = useState(false);

  useEffect(() => {
    if (periodIdFromRoute) {
      setSelectedPeriodId(periodIdFromRoute);
    }
  }, [periodIdFromRoute]);

  useEffect(() => {
    if (selectedPeriodId || !feePeriodsQuery.data || feePeriodsQuery.data.length === 0) {
      return;
    }

    setSelectedPeriodId(feePeriodsQuery.data[0].id);
  }, [feePeriodsQuery.data, selectedPeriodId]);

  useEffect(() => {
    if (!selectedPeriodId || !feePeriodsQuery.data || feePeriodsQuery.data.length === 0) {
      return;
    }

    const selectedPeriodStillExists = feePeriodsQuery.data.some((period) => period.id === selectedPeriodId);
    if (!selectedPeriodStillExists) {
      setSelectedPeriodId(feePeriodsQuery.data[0].id);
    }
  }, [feePeriodsQuery.data, selectedPeriodId]);

  const selectedPeriod = useMemo<FeePeriodDto | null>(() => {
    if (!feePeriodsQuery.data || !selectedPeriodId) {
      return null;
    }

    return feePeriodsQuery.data.find((period) => period.id === selectedPeriodId) ?? null;
  }, [feePeriodsQuery.data, selectedPeriodId]);

  const paymentsQuery = usePayments(selectedPeriodId);
  const recordPaymentMutation = useRecordPayment(studentId);
  const reversePaymentMutation = useReversePayment(studentId);

  const submitRecordPayment = async (body: RecordPaymentRequest): Promise<void> => {
    await recordPaymentMutation.mutateAsync(body);
    setShowRecordForm(false);
  };

  const confirmReversePayment = (paymentId: string): void => {
    if (!selectedPeriodId) {
      return;
    }

    Alert.alert(
      "Reverse payment",
      "This will soft-delete the payment and recalculate period totals.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reverse",
          style: "destructive",
          onPress: () => {
            void reversePaymentMutation.mutateAsync({ paymentId, feePeriodId: selectedPeriodId });
          },
        },
      ],
    );
  };

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Payments</Text>
          <Text style={styles.stateBody}>Select an organization first from Home.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!studentId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Payments</Text>
          <Text style={styles.stateBody}>Student id is missing.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (feePeriodsQuery.isPending) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#1d4ed8" />
          <Text style={styles.stateBody}>Loading periods...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (feePeriodsQuery.isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Could not load periods</Text>
          <Text style={styles.stateBody}>
            {getApiErrorMessage(feePeriodsQuery.error) ?? "Please try again."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!feePeriodsQuery.data || feePeriodsQuery.data.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No fee periods yet</Text>
          <Text style={styles.stateBody}>Set fee and generate periods before recording payments.</Text>
          <Pressable
            onPress={() => {
              router.push(`/(app)/(teacher)/students/${studentId}/periods` as Href);
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Open periods</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.kicker}>Teacher Workspace</Text>
            <Text style={styles.title}>Payments</Text>
          </View>

          <Pressable
            onPress={() => {
              router.push(`/(app)/(teacher)/students/${studentId}/periods` as Href);
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Back to periods</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select Period</Text>
          <View style={styles.periodOptionRow}>
            {feePeriodsQuery.data.map((period) => {
              const isActive = selectedPeriodId === period.id;
              const label = `${period.periodYear}-${String(period.periodMonth).padStart(2, "0")}`;

              return (
                <Pressable
                  key={period.id}
                  onPress={() => {
                    setSelectedPeriodId(period.id);
                    setShowRecordForm(false);
                  }}
                  style={[styles.periodOption, isActive && styles.periodOptionActive]}
                >
                  <Text style={[styles.periodOptionText, isActive && styles.periodOptionTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {selectedPeriod ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Selected Period</Text>
              <Pressable
                onPress={() => {
                  setShowRecordForm((current) => !current);
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{showRecordForm ? "Close" : "Record"}</Text>
              </Pressable>
            </View>

            <FeePeriodCard period={selectedPeriod} selected />

            {showRecordForm ? (
              <RecordPaymentForm
                errorMessage={
                  recordPaymentMutation.isError
                    ? (getApiErrorMessage(recordPaymentMutation.error) ?? "Could not record payment.")
                    : null
                }
                feePeriodId={selectedPeriod.id}
                isSubmitting={recordPaymentMutation.isPending}
                onCancel={() => {
                  setShowRecordForm(false);
                }}
                onSubmit={submitRecordPayment}
                studentId={studentId}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recorded Payments</Text>
            <Pressable
              onPress={() => {
                void paymentsQuery.refetch();
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
          </View>

          {paymentsQuery.isPending ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color="#1d4ed8" />
              <Text style={styles.stateBody}>Loading payments...</Text>
            </View>
          ) : null}

          {paymentsQuery.isError ? (
            <Text style={styles.errorText}>
              {getApiErrorMessage(paymentsQuery.error) ?? "Could not load payments."}
            </Text>
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
                    <Text style={styles.paymentMeta}>Created: {formatDate(payment.createdAt)}</Text>
                  </View>

                  <Pressable
                    disabled={reversePaymentMutation.isPending}
                    onPress={() => {
                      confirmReversePayment(payment.id);
                    }}
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
    backgroundColor: "#f1f5f9",
  },
  contentContainer: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  headerTextWrap: {
    gap: 2,
    flex: 1,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0d9488",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  periodOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  periodOptionActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  periodOptionText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  periodOptionTextActive: {
    color: "#1e3a8a",
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  paymentList: {
    gap: 8,
  },
  paymentItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#f8fafc",
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
    color: "#0f172a",
  },
  paymentMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  reverseButton: {
    borderRadius: 10,
    backgroundColor: "#b91c1c",
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reverseButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  centerState: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  inlineState: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#f8fafc",
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  stateCard: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
});
