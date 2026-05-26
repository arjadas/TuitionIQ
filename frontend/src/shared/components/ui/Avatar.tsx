import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/src/shared/theme/tokens";

type AvatarProps = {
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function getInitials(name: string | null | undefined): string {
  if (!name) {
    return "?";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({ name, size = 40, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.avatarFg,
    fontWeight: "700",
  },
});
