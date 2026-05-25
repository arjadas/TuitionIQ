import type { SetFeeRequest } from "@tuitioniq/types";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type SetFeeFormProps = {
  submitLabel?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: SetFeeRequest) => Promise<void> | void;
  onCancel?: () => void;
};

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day
  );
}

export function SetFeeForm({
  submitLabel = "Set fee",
  isSubmitting = false,
  errorMessage = null,
  onSubmit,
  onCancel,
}: SetFeeFormProps) {
  const [manualFeeText, setManualFeeText] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(toDateOnlyString(new Date()));
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    const normalizedFeeText = manualFeeText.trim();

    if (!/^\d+$/.test(normalizedFeeText)) {
      setValidationError("Manual fee must be a whole number.");
      return;
    }

    const manualFee = Number(normalizedFeeText);
    if (!Number.isSafeInteger(manualFee) || manualFee < 0) {
      setValidationError("Manual fee must be 0 or greater.");
      return;
    }

    if (!isValidDateOnly(effectiveFrom)) {
      setValidationError("Effective date must be in YYYY-MM-DD format.");
      return;
    }

    setValidationError(null);

    await onSubmit({
      feeSource: "Manual",
      manualFee,
      currency: "BDT",
      effectiveFrom: effectiveFrom.trim(),
      notes: notes.trim().length > 0 ? notes.trim() : null,
      overrideReason: null,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Manual fee (whole BDT)</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setManualFeeText}
          placeholder="e.g. 1500"
          style={styles.input}
          value={manualFeeText}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Currency</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyValue}>BDT</Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Effective date (YYYY-MM-DD)</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setEffectiveFrom}
          placeholder="2026-04-27"
          style={styles.input}
          value={effectiveFrom}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          multiline
          numberOfLines={3}
          onChangeText={setNotes}
          placeholder="Optional fee configuration notes"
          style={[styles.input, styles.textArea]}
          value={notes}
        />
      </View>

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.buttonRow}>
        {onCancel ? (
          <Pressable onPress={onCancel} style={[styles.button, styles.secondaryButton]}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}

        <Pressable
          disabled={isSubmitting}
          onPress={() => {
            void submit();
          }}
          style={[styles.button, styles.primaryButton, isSubmitting && styles.disabledButton]}
        >
          {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{submitLabel}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  readOnlyField: {
    borderWidth: 1,
    borderColor: "#dbe5ef",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  readOnlyValue: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: "#1d4ed8",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
