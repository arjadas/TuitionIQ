import { StyleSheet, Text, View } from "react-native";
import { validatePassword } from "@/src/shared/utils/passwordValidation";

type PasswordStrengthMeterProps = {
  password: string;
};

function getStrengthLabel(score: number): string {
  if (score <= 1) {
    return "Very weak";
  }

  if (score <= 3) {
    return "Needs improvement";
  }

  if (score === 4) {
    return "Strong";
  }

  return "Very strong";
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const validation = validatePassword(password);
  const score = validation.score;

  return (
    <View style={styles.wrapper}>
      <View style={styles.barRow}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View
            key={index}
            style={[
              styles.bar,
              index < score ? styles.barActive : styles.barInactive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>Password strength: {getStrengthLabel(score)}</Text>
      <View style={styles.requirements}>
        <Text style={styles.requirement}>At least 8 characters</Text>
        <Text style={styles.requirement}>Uppercase and lowercase letters</Text>
        <Text style={styles.requirement}>At least one number and one special character</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  barRow: {
    flexDirection: "row",
    gap: 6,
  },
  bar: {
    height: 6,
    borderRadius: 999,
    flex: 1,
  },
  barActive: {
    backgroundColor: "#14b8a6",
  },
  barInactive: {
    backgroundColor: "#dbeafe",
  },
  label: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "600",
  },
  requirements: {
    gap: 2,
  },
  requirement: {
    fontSize: 12,
    color: "#64748b",
  },
});
