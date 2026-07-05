import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/src/shared/components/ui/Button";
import { Card } from "@/src/shared/components/ui/Card";
import { colors, spacing } from "@/src/shared/theme/tokens";

type HomeWelcomeProps = {
  onCreateOrganization: () => void;
};

export function HomeWelcome({ onCreateOrganization }: HomeWelcomeProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name="school-outline" size={30} color={colors.primary} />
      </View>

      <Text style={styles.title}>Welcome to TuitionIQ</Text>
      <Text style={styles.body}>
        Set up your organisation to start managing students, fees, and payments.
      </Text>

      <Button label="Create organisation" onPress={onCreateOrganization} style={styles.cta} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  cta: {
    alignSelf: "stretch",
    marginTop: spacing.xs,
  },
});
