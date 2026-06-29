import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { radius } from "@/src/shared/theme/tokens";
import { feeStatusPalette } from "@/src/features/billing/utils/feeStatus";

type PaymentStatusBadgeProps = {
  status: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Canonical badge for fee-period payment statuses (paid / partial / unpaid /
 * overdue / waived). Replaces the per-screen palette helpers that were
 * previously duplicated in FeePeriodCard, billing/index and the payments screen.
 */
export function PaymentStatusBadge({ status, style }: PaymentStatusBadgeProps) {
  const palette = feeStatusPalette(status);

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.label, { color: palette.fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
