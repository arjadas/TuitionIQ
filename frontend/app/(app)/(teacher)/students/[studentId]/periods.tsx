import type { FeePeriodDto, SetFeeRequest } from "@tuitioniq/types";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { FeePeriodList } from "@/src/features/billing/components/FeePeriodList";
import { SetFeeForm } from "@/src/features/billing/components/SetFeeForm";
import { WaivePeriodForm } from "@/src/features/billing/components/WaivePeriodForm";
import { useFeePeriods, useSetFee, useWaivePeriod } from "@/src/features/billing/hooks/useFeePeriods";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { resolveRouteParam } from "@/src/shared/utils/resolveRouteParam";
import { useOrgStore } from "@/src/store/orgStore";

export default function StudentFeePeriodsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string | string[] }>();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const studentId = useMemo(() => resolveRouteParam(params.studentId), [params.studentId]);
  const feePeriodsQuery = useFeePeriods(studentId);
  const setFeeMutation = useSetFee(studentId);
  const waivePeriodMutation = useWaivePeriod(studentId);

  const [showSetFeeForm, setShowSetFeeForm] = useState(false);
  const [waivingPeriod, setWaivingPeriod] = useState<FeePeriodDto | null>(null);

  const submitSetFee = async (payload: SetFeeRequest): Promise<void> => {
    await setFeeMutation.mutateAsync(payload);
    setShowSetFeeForm(false);
  };

  const submitWaive = async (waiverReason: string): Promise<void> => {
    if (!waivingPeriod) {
      return;
    }

    await waivePeriodMutation.mutateAsync({ periodId: waivingPeriod.id, body: { waiverReason } });
    setWaivingPeriod(null);
  };

  const periodLabel = (period: FeePeriodDto): string =>
    `${period.periodYear}-${String(period.periodMonth).padStart(2, "0")}`;

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Billing</Text>
          <Text style={styles.stateBody}>Select an organization first from Home.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!studentId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Billing</Text>
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
          <Text style={styles.stateBody}>Loading fee periods...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (feePeriodsQuery.isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Could not load fee periods</Text>
          <Text style={styles.stateBody}>
            {getApiErrorMessage(feePeriodsQuery.error) ?? "Please try again."}
          </Text>
          <Pressable
            onPress={() => {
              void feePeriodsQuery.refetch();
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Retry</Text>
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
            <Text style={styles.title}>Fee Periods</Text>
          </View>

          <Pressable
            onPress={() => {
              setShowSetFeeForm((current) => !current);
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{showSetFeeForm ? "Close" : "Set Fee"}</Text>
          </Pressable>
        </View>

        {showSetFeeForm ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Set Student Fee</Text>
            <SetFeeForm
              errorMessage={
                setFeeMutation.isError
                  ? (getApiErrorMessage(setFeeMutation.error) ?? "Could not set fee.")
                  : null
              }
              isSubmitting={setFeeMutation.isPending}
              onCancel={() => {
                setShowSetFeeForm(false);
              }}
              onSubmit={submitSetFee}
              submitLabel="Save fee"
            />
          </View>
        ) : null}

        {waivingPeriod ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Waive {periodLabel(waivingPeriod)}</Text>
            <WaivePeriodForm
              errorMessage={
                waivePeriodMutation.isError
                  ? (getApiErrorMessage(waivePeriodMutation.error) ?? "Could not waive period.")
                  : null
              }
              isSubmitting={waivePeriodMutation.isPending}
              onCancel={() => setWaivingPeriod(null)}
              onSubmit={submitWaive}
              periodLabel={periodLabel(waivingPeriod)}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Periods</Text>
            <Pressable
              onPress={() => {
                void feePeriodsQuery.refetch();
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
          </View>

          <FeePeriodList
            onSelectPeriod={(period) => {
              router.push(
                `/(app)/(teacher)/students/${studentId}/payments?periodId=${period.id}` as Href,
              );
            }}
            onWaive={(period) => setWaivingPeriod(period)}
            periods={feePeriodsQuery.data ?? []}
          />
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
    gap: 12,
  },
  headerTextWrap: {
    gap: 2,
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
    fontSize: 19,
    fontWeight: "700",
    color: "#0f172a",
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: "#1d4ed8",
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
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
  waiveErrorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
});
