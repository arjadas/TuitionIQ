import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MembershipDto } from "@tuitioniq/types";
import { Avatar } from "@/src/shared/components/ui/Avatar";
import { RoleBadge } from "@/src/shared/components/ui/RoleBadge";
import { colors, radius, spacing } from "@/src/shared/theme/tokens";

type OrgSelectorCardProps = {
  membership: MembershipDto;
  selected?: boolean;
  onPress: () => void;
};

export function OrgSelectorCard({ membership, selected = false, onPress }: OrgSelectorCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <Avatar name={membership.organization.name} size={44} />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {membership.organization.name}
        </Text>
        <View style={styles.metaRow}>
          <RoleBadge role={membership.role} />
          {selected ? <Text style={styles.currentLabel}>Current</Text> : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#EFF4FF",
  },
  cardPressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
  },
});
