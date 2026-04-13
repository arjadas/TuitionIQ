import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { PasswordStrengthMeter } from "@/src/shared/components/ui/PasswordStrengthMeter";

type PasswordInputProps = TextInputProps & {
  label: string;
  showStrength?: boolean;
};

export function PasswordInput({ label, showStrength = false, value, style, ...props }: PasswordInputProps)
{
  const [isVisible, setIsVisible] = useState(false);

  const iconName = useMemo(() => (isVisible ? "eye-off" : "eye"), [isVisible]);
  const passwordValue = typeof value === "string" ? value : "";

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...props}
          value={value}
          style={[styles.input, style]}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          accessibilityLabel={isVisible ? "Hide password" : "Show password"}
          accessibilityRole="button"
          onPress={() => setIsVisible((current) => !current)}
          style={styles.iconButton}
        >
          <Ionicons color="#475569" name={iconName} size={20} />
        </Pressable>
      </View>

      {showStrength ? <PasswordStrengthMeter password={passwordValue} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: "#0f172a",
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
