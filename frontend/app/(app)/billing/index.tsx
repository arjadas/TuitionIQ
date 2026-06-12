import { Ionicons } from "@expo/vector-icons";
import type { OrgFeePeriodDto } from "@tuitioniq/types";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useOrgPeriods } from "@/src/features/billing/hooks/useOrgPeriods";
import { Card } from "@/src/shared/components/ui/Card";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { formatCurrency } from "@/src/shared/utils/formatCurrency";
import { colors, radius, spacing } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";

const STATUS_OPTIONS = ["all", "Unpaid", "Partial", "Paid", "Overdue", "Waived"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

function statusPalette(status: string): { badge: string; text: string } {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return { badge: colors.successBg, text: colors.successFg };
    case "partial":
      return { badge: "#FFEDD5", text: "#9A3412" };
    case "unpaid":
      return { badge: colors.dangerBg, text: colors.dangerFg };
    case "waived":
      return { badge: "#EDE9FE", text: "#5B21B6" };
    case "overdue":
      return { badge: "#FEF3C7", text: "#92400E" };
    default:
      return { badge: colors.neutralBg, text: colors.neutralFg };
  }
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function OrgBillingScreen() {
  const router = useRouter();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [status, setStatus] = useState<StatusOption>("all");

  const periodsQuery = useOrgPeriods({
    year: period.year,
    month: period.month,
    status: status === "all" ? undefined : status,
  });

  const periods = useMemo(() => periodsQuery.data ?? [], [periodsQuery.data]);

  const totals = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    for (const item of periods) {
      collected += item.amountPaid;
      if (item.status.trim().toLowerCase() !== "waived") {
        outstanding += Math.max(item.fee - item.amountPaid, 0);
      }
    }
    return { collected, outstanding };
  }, [periods]);

  const currency = periods[0]?.currency ?? "BDT";

  const goToPrevMonth = (): void => {
    setPeriod((current) =>
      current.month === 1 ? { year: current.year - 1, month: 12 } : { year: current.year, month: current.month - 1 },
    );
  };

  const goToNextMonth = (): void => {
    setPeriod((current) =>
      current.month === 12 ? { year: current.year + 1, month: 1 } : { year: current.year, month: current.month + 1 },
    );
  };

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <Text style={styles.title}>Billing</Text>
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
          <Text style={styles.title}>Billing overview</Text>
        </View>

        <Card>
          <View style={styles.monthRow}>
            <Pressable accessibilityLabel="Previous month" accessibilityRole="button" hitSlop={8} onPress={goToPrevMonth} style={styles.monthArrow}>
              <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel(period.year, period.month)}</Text>
            <Pressable accessibilityLabel="Next month" accessibilityRole="button" hitSlop={8} onPress={goToNextMonth} style={styles.monthArrow}>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.totalsRow}>
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Collected</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.collected, currency)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Outstanding</Text>
              <Text style={[styles.totalValue, styles.totalOutstanding]}>
                {formatCurrency(totals.outstanding, currency)}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.filterRow}>
          {STATUS_OPTIONS.map((option) => {
            const active = status === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setStatus(option)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {option === "all" ? "All" : option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {periodsQuery.isPending ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.stateBody}>Loading billing periods...</Text>
          </View>
        ) : null}

        {periodsQuery.isError ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Could not load billing</Text>
            <Text style={styles.stateBody}>{getApiErrorMessage(periodsQuery.error) ?? "Please try again."}</Text>
          </View>
        ) : null}

        {!periodsQuery.isPending && !periodsQuery.isError && periods.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>No billing periods</Text>
            <Text style={styles.stateBody}>
              No fee periods for {monthLabel(period.year, period.month)}
              {status === "all" ? "" : ` with status “${status}”`}.
            </Text>
          </View>
        ) : null}

        {!periodsQuery.isError && periods.length > 0 ? (
          <View style={styles.list}>
            {periods.map((item) => (
              <OrgPeriodRow
                key={item.id}
                onPress={() => router.push(`/billing/${item.id}` as Href)}
                period={item}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrgPeriodRow({ period, onPress }: { period: OrgFeePeriodDto; onPress: () => void }) {
  const palette = statusPalette(period.status);
  const balance = Math.max(period.fee - period.amountPaid, 0);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowHeader}>
        <Text numberOfLines={1} style={styles.rowName}>{period.studentName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: palette.badge }]}>
          <Text style={[styles.statusText, { color: palette.text }]}>{period.status}</Text>
        </View>
      </View>
      <View style={styles.rowAmounts}>
        <Text style={styles.rowAmountLabel}>
          Fee <Text style={styles.rowAmountValue}>{formatCurrency(period.fee, period.currency)}</Text>
        </Text>
        <Text style={styles.rowAmountLabel}>
          Paid <Text style={styles.rowAmountValue}>{formatCurrency(period.amountPaid, period.currency)}</Text>
        </Text>
        <Text style={styles.rowAmountLabel}>
          Balance <Text style={styles.rowAmountValue}>{formatCurrency(balance, period.currency)}</Text>
        </Text>
      </View>
    </Pressable>
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
    gap: 2,
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
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthArrow: {
    padding: 4,
    borderRadius: radius.sm,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  totalsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  totalCell: {
    flex: 1,
    gap: 3,
  },
  totalDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  totalOutstanding: {
    color: colors.warning,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.avatarBg,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  list: {
    gap: 10,
  },
  row: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
    padding: 13,
    gap: 9,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowAmounts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  rowAmountLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowAmountValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  centerState: {
    borderRadius: radius.lg,
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
