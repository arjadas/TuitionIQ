import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/shared/theme/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

type SettingRowProps = {
  label: string;
  icon?: IconName;
  description?: string;
  onPress?: () => void;
  right?: ReactNode;
  comingSoon?: boolean;
  danger?: boolean;
  showChevron?: boolean;
};

export function SettingRow({
  label,
  icon,
  description,
  onPress,
  right,
  comingSoon = false,
  danger = false,
  showChevron = false,
}: SettingRowProps) {
  const disabled = comingSoon || !onPress;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.rowPressed]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={danger ? colors.danger : colors.textMuted}
          style={styles.icon}
        />
      ) : null}

      <View style={styles.textWrap}>
        <Text style={[styles.label, danger && styles.labelDanger, comingSoon && styles.labelMuted]}>
          {label}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      {comingSoon ? (
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>Coming soon</Text>
        </View>
      ) : right ? (
        right
      ) : showChevron ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
  },
  rowPressed: {
    opacity: 0.6,
  },
  icon: {
    width: 20,
    textAlign: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  labelDanger: {
    color: colors.danger,
  },
  labelMuted: {
    color: colors.textMuted,
  },
  description: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  comingSoon: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.neutralBg,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.neutralFg,
  },
});
