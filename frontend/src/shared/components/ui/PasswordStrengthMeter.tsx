import { StyleSheet, Text, View } from "react-native";
import { validatePassword } from "@/src/shared/utils/passwordValidation";

type PasswordStrengthMeterProps = {
  password: string;
};

type StrengthLevel = "empty" | "weak" | "medium" | "strong";

function resolveStrength(password: string): StrengthLevel
{
  if (!password) {
    return "empty";
  }

  const validation = validatePassword(password);
  if (validation.valid) {
    return "strong";
  }

  if (validation.errors.length <= 2) {
    return "medium";
  }

  return "weak";
}

function getLabel(level: StrengthLevel): string
{
  if (level === "empty") {
    return "Empty";
  }

  if (level === "weak") {
    return "Weak";
  }

  if (level === "medium") {
    return "Medium";
  }

  return "Strong";
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps)
{
  const level = resolveStrength(password);

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            level === "empty" && styles.empty,
            level === "weak" && styles.weak,
            level === "medium" && styles.medium,
            level === "strong" && styles.strong,
          ]}
        />
      </View>
      <Text style={styles.label}>Password strength: {getLabel(level)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  empty: {
    width: "0%",
  },
  weak: {
    width: "35%",
    backgroundColor: "#ef4444",
  },
  medium: {
    width: "65%",
    backgroundColor: "#f59e0b",
  },
  strong: {
    width: "100%",
    backgroundColor: "#16a34a",
  },
  label: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
});
