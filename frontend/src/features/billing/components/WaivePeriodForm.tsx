import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "@/src/shared/theme/tokens";

type WaivePeriodFormProps = {
  periodLabel: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (waiverReason: string) => Promise<void> | void;
  onCancel?: () => void;
};

export function WaivePeriodForm({
  periodLabel,
  isSubmitting = false,
  errorMessage = null,
  onSubmit,
  onCancel,
}: WaivePeriodFormProps) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  const trimmedReason = reason.trim();

  const goToConfirm = (): void => {
    if (trimmedReason.length === 0) {
      setValidationError("A waiver reason is required.");
      return;
    }

    setValidationError(null);
    setStep(2);
  };

  const submit = async (): Promise<void> => {
    await onSubmit(trimmedReason);
  };

  if (step === 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.confirmTitle}>Waive {periodLabel}?</Text>
        <Text style={styles.confirmBody}>
          The fee for this period will be marked as waived and is no longer collectible. This won&apos;t be
          overwritten when payments change.
        </Text>
        <View style={styles.reasonPreview}>
          <Text style={styles.reasonPreviewLabel}>Reason</Text>
          <Text style={styles.reasonPreviewText}>{trimmedReason}</Text>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => setStep(1)}
            style={[styles.button, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => {
              void submit();
            }}
            style={[styles.button, styles.dangerButton, isSubmitting && styles.disabledButton]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.dangerButtonText}>Waive period</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Waiver reason</Text>
      <TextInput
        multiline
        numberOfLines={3}
        onChangeText={setReason}
        placeholder="Why is this period being waived?"
        style={[styles.input, styles.textArea]}
        value={reason}
      />

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}

      <View style={styles.buttonRow}>
        {onCancel ? (
          <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.button, styles.secondaryButton]}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={goToConfirm} style={[styles.button, styles.primaryButton]}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textLabel,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  confirmBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  reasonPreview: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    padding: 10,
    gap: 3,
  },
  reasonPreviewLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  reasonPreviewText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerFg,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 14,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
