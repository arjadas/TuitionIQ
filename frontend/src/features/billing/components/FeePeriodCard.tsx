import type { FeePeriodDto } from "@tuitioniq/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCurrency } from "@/src/shared/utils/formatCurrency";

type FeePeriodCardProps = {
  period: FeePeriodDto;
  selected?: boolean;
  onPress?: (period: FeePeriodDto) => void;
};

function getStatusPalette(status: string): { badge: string; text: string } {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return { badge: "#dcfce7", text: "#166534" };
    case "partial":
      return { badge: "#ffedd5", text: "#9a3412" };
    case "unpaid":
      return { badge: "#fee2e2", text: "#991b1b" };
    case "waived":
      return { badge: "#ede9fe", text: "#5b21b6" };
    case "overdue":
      return { badge: "#fef3c7", text: "#92400e" };
    default:
      return { badge: "#e2e8f0", text: "#334155" };
  }
}

function getBalanceAmount(period: FeePeriodDto): number {
  return Math.max(period.fee - period.amountPaid, 0);
}

function buildPeriodTitle(period: FeePeriodDto): string {
  return `${period.periodYear}-${String(period.periodMonth).padStart(2, "0")}`;
}

export function FeePeriodCard({ period, selected = false, onPress }: FeePeriodCardProps) {
  const statusPalette = getStatusPalette(period.status);
  const balanceAmount = getBalanceAmount(period);

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        onPress?.(period);
      }}
      style={[styles.card, selected && styles.selectedCard]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.periodTitle}>Period {buildPeriodTitle(period)}</Text>

        <View style={[styles.statusBadge, { backgroundColor: statusPalette.badge }]}>
          <Text style={[styles.statusText, { color: statusPalette.text }]}>{period.status}</Text>
        </View>
      </View>

      <View style={styles.amountGrid}>
        <View style={styles.amountCell}>
          <Text style={styles.amountLabel}>Fee</Text>
          <Text style={styles.amountValue}>{formatCurrency(period.fee, period.currency)}</Text>
        </View>

        <View style={styles.amountCell}>
          <Text style={styles.amountLabel}>Paid</Text>
          <Text style={styles.amountValue}>{formatCurrency(period.amountPaid, period.currency)}</Text>
        </View>

        <View style={styles.amountCell}>
          <Text style={styles.amountLabel}>Balance</Text>
          <Text style={styles.amountValue}>{formatCurrency(balanceAmount, period.currency)}</Text>
        </View>
      </View>

      {period.dueDate ? <Text style={styles.metaText}>Due date: {period.dueDate}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  selectedCard: {
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  periodTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  amountGrid: {
    flexDirection: "row",
    gap: 8,
  },
  amountCell: {
    flex: 1,
    gap: 2,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  metaText: {
    fontSize: 12,
    color: "#64748b",
  },
});
