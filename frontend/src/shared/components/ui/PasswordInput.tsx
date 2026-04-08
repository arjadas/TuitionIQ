import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

type PasswordInputProps = Omit<TextInputProps, "secureTextEntry"> & {
  label: string;
  errorMessage?: string | null;
};

export function PasswordInput({ label, errorMessage, style, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  const toggleLabel = useMemo(() => (isVisible ? "Hide" : "Show"), [isVisible]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, errorMessage ? styles.inputWrapError : null]}>
        <TextInput
          {...props}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!isVisible}
          style={[styles.input, style]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setIsVisible((current) => !current);
          }}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>{toggleLabel}</Text>
        </Pressable>
      </View>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  inputWrapError: {
    borderColor: "#ef4444",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: "#0f172a",
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
});
