import type { RecordPaymentRequest } from "@tuitioniq/types";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const PAYMENT_METHODS = ["Cash", "BankTransfer", "Card", "Cheque", "Other"] as const;

type RecordPaymentFormProps = {
  studentId: string;
  feePeriodId: string;
  currency?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: RecordPaymentRequest) => Promise<void> | void;
  onCancel?: () => void;
};

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return candidate;
}

export function RecordPaymentForm({
  studentId,
  feePeriodId,
  currency = "BDT",
  submitLabel = "Record payment",
  isSubmitting = false,
  errorMessage = null,
  onSubmit,
  onCancel,
}: RecordPaymentFormProps) {
  const [amountText, setAmountText] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("Cash");
  const [paymentDate, setPaymentDate] = useState(toDateOnlyString(new Date()));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    const normalizedAmountText = amountText.trim();
    if (!/^\d+$/.test(normalizedAmountText)) {
      setValidationError("Amount must be a whole positive number.");
      return;
    }

    const amount = Number(normalizedAmountText);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setValidationError("Amount must be greater than 0.");
      return;
    }

    const parsedPaymentDate = parseDateOnly(paymentDate);
    if (!parsedPaymentDate) {
      setValidationError("Payment date must be in YYYY-MM-DD format.");
      return;
    }

    const today = parseDateOnly(toDateOnlyString(new Date()));
    if (!today) {
      setValidationError("Could not validate payment date.");
      return;
    }

    if (parsedPaymentDate.getTime() > today.getTime()) {
      setValidationError("Payment date cannot be in the future.");
      return;
    }

    setValidationError(null);

    await onSubmit({
      studentId,
      feePeriodId,
      amount,
      currency: currency.trim().toUpperCase(),
      paymentDate: paymentDate.trim(),
      paymentMethod,
      reference: reference.trim().length > 0 ? reference.trim() : null,
      notes: notes.trim().length > 0 ? notes.trim() : null,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Amount (whole BDT)</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setAmountText}
          placeholder="e.g. 1500"
          style={styles.input}
          value={amountText}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Payment method</Text>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((method) => {
            const isSelected = paymentMethod === method;

            return (
              <Pressable
                key={method}
                onPress={() => {
                  setPaymentMethod(method);
                }}
                style={[styles.methodOption, isSelected && styles.methodOptionActive]}
              >
                <Text style={[styles.methodText, isSelected && styles.methodTextActive]}>{method}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Payment date (YYYY-MM-DD)</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setPaymentDate}
          placeholder="2026-04-27"
          style={styles.input}
          value={paymentDate}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Reference (optional)</Text>
        <TextInput
          onChangeText={setReference}
          placeholder="Receipt or transaction id"
          style={styles.input}
          value={reference}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          multiline
          numberOfLines={3}
          onChangeText={setNotes}
          placeholder="Any context for this payment"
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
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  methodOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  methodOptionActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  methodText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  methodTextActive: {
    color: "#1e3a8a",
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
