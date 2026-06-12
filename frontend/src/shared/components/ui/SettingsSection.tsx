import { Ionicons } from "@expo/vector-icons";
import { Children, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "@/src/shared/components/ui/Card";
import { colors } from "@/src/shared/theme/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

type SettingsSectionProps = {
  title: string;
  icon: IconName;
  accent?: string;
  description?: string;
  children: ReactNode;
};

export function SettingsSection({
  title,
  icon,
  accent = colors.primary,
  description,
  children,
}: SettingsSectionProps) {
  const items = Children.toArray(children);

  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Ionicons name={icon} size={17} color={accent} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {description ? <Text style={styles.description}>{description}</Text> : null}

      <View style={styles.rows}>
        {items.map((child, index) => (
          <View key={`row-${index}`}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {child}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  description: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  rows: {
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
