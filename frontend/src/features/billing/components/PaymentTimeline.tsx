import type { FeePeriodDto } from "@tuitioniq/types";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  feeStatusPalette,
  isOutstandingStatus,
  isWaivedStatus,
  periodMonthShortLabel,
} from "@/src/features/billing/utils/feeStatus";
import { PaymentStatusBadge } from "@/src/shared/components/ui/PaymentStatusBadge";
import { formatCurrency } from "@/src/shared/utils/formatCurrency";
import { colors, radius, spacing } from "@/src/shared/theme/tokens";

type PaymentTimelineProps = {
  periods: FeePeriodDto[];
  onSelectPeriod?: (period: FeePeriodDto) => void;
};

type TimelineSummary = {
  currency: string;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  outstandingMonths: number;
  paidMonths: number;
};

function buildSummary(periods: FeePeriodDto[]): TimelineSummary {
  let totalBilled = 0;
  let totalPaid = 0;
  let outstanding = 0;
  let outstandingMonths = 0;
  let paidMonths = 0;

  for (const period of periods) {
    totalPaid += period.amountPaid;

    if (!isWaivedStatus(period.status)) {
      totalBilled += period.fee;
      outstanding += Math.max(period.fee - period.amountPaid, 0);
    }

    if (isOutstandingStatus(period.status)) {
      outstandingMonths += 1;
    }

    if (period.status.trim().toLowerCase() === "paid") {
      paidMonths += 1;
    }
  }

  return {
    currency: periods[0]?.currency ?? "BDT",
    totalBilled,
    totalPaid,
    outstanding,
    outstandingMonths,
    paidMonths,
  };
}

/**
 * Chronological month-by-month view of a student's fee periods (from enrolment
 * onward). Each month is colour-coded by payment status so an admin/teacher can
 * see at a glance which months are paid and which are outstanding.
 */
export function PaymentTimeline({ periods, onSelectPeriod }: PaymentTimelineProps) {
  // The periods API returns newest-first; show the timeline oldest-first so it
  // reads naturally from enrolment month forward.
  const orderedPeriods = useMemo(
    () =>
      [...periods].sort((a, b) =>
        a.periodYear !== b.periodYear ? a.periodYear - b.periodYear : a.periodMonth - b.periodMonth,
      ),
    [periods],
  );

  const summary = useMemo(() => buildSummary(orderedPeriods), [orderedPeriods]);

  if (orderedPeriods.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No fee periods yet</Text>
        <Text style={styles.emptyBody}>
          This student has no generated billing months. Set a fee to start their schedule.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Paid</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalPaid, summary.currency)}</Text>
          <Text style={styles.summaryMeta}>{summary.paidMonths} months cleared</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Outstanding</Text>
          <Text style={[styles.summaryValue, styles.summaryOutstanding]}>
            {formatCurrency(summary.outstanding, summary.currency)}
          </Text>
          <Text style={styles.summaryMeta}>{summary.outstandingMonths} months due</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {orderedPeriods.map((period) => {
          const palette = feeStatusPalette(period.status);
          const balance = Math.max(period.fee - period.amountPaid, 0);

          return (
            <Pressable
              key={period.id}
              accessibilityRole={onSelectPeriod ? "button" : undefined}
              disabled={!onSelectPeriod}
              onPress={() => onSelectPeriod?.(period)}
              style={({ pressed }) => [
                styles.monthCell,
                { borderLeftColor: palette.fg },
                pressed && onSelectPeriod ? styles.monthCellPressed : null,
              ]}
            >
              <View style={styles.monthHeader}>
                <Text style={styles.monthLabel}>
                  {periodMonthShortLabel(period.periodYear, period.periodMonth)}
                </Text>
                <PaymentStatusBadge status={period.status} />
              </View>

              <View style={styles.monthAmounts}>
                <Text style={styles.monthAmountText}>
                  {formatCurrency(period.amountPaid, period.currency)}
                  <Text style={styles.monthAmountMuted}>
                    {" / "}
                    {formatCurrency(period.fee, period.currency)}
                  </Text>
                </Text>
                {balance > 0 ? (
                  <Text style={styles.monthBalance}>
                    {formatCurrency(balance, period.currency)} due
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
  },
  summaryCell: {
    flex: 1,
    gap: 3,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  summaryOutstanding: {
    color: colors.warning,
  },
  summaryMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  monthCell: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 150,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  monthCellPressed: {
    opacity: 0.75,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  monthAmounts: {
    gap: 2,
  },
  monthAmountText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  monthAmountMuted: {
    fontWeight: "400",
    color: colors.textMuted,
  },
  monthBalance: {
    fontSize: 12,
    color: colors.warningFg,
    fontWeight: "600",
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
