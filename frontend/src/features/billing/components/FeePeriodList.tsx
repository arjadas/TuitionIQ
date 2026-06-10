import type { FeePeriodDto } from "@tuitioniq/types";
import { StyleSheet, Text, View } from "react-native";
import { FeePeriodCard } from "@/src/features/billing/components/FeePeriodCard";

type FeePeriodListProps = {
  periods: FeePeriodDto[];
  selectedPeriodId?: string | null;
  onSelectPeriod?: (period: FeePeriodDto) => void;
  onWaive?: (period: FeePeriodDto) => void;
};

export function FeePeriodList({
  periods,
  selectedPeriodId = null,
  onSelectPeriod,
  onWaive,
}: FeePeriodListProps) {
  if (periods.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No fee periods yet</Text>
        <Text style={styles.emptyBody}>
          Set a fee first, then generate periods from the backend workflow.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listWrap}>
      {periods.map((period) => (
        <FeePeriodCard
          key={period.id}
          onPress={onSelectPeriod}
          onWaive={onWaive}
          period={period}
          selected={selectedPeriodId === period.id}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listWrap: {
    gap: 10,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
