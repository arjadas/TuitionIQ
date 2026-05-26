import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/shared/theme/tokens";

type AuthLoadingScreenProps = {
  message?: string;
};

export function AuthLoadingScreen({ message = "Loading your workspace..." }: AuthLoadingScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>TUITIONIQ</Text>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: colors.action,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
