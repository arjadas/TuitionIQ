import type { CreateStudentRequest, StudentDto } from "@tuitioniq/types";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

type StudentFormProps = {
  submitLabel: string;
  initialStudent?: StudentDto | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: CreateStudentRequest) => Promise<void> | void;
  onCancel?: () => void;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  metadata: string;
};

function normalizeMetadataForEditor(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) {
    return "";
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildInitialState(initialStudent?: StudentDto | null): FormState {
  if (!initialStudent) {
    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      metadata: "",
    };
  }

  return {
    firstName: initialStudent.firstName,
    lastName: initialStudent.lastName,
    email: initialStudent.email ?? "",
    phone: initialStudent.phone ?? "",
    notes: initialStudent.notes ?? "",
    metadata: normalizeMetadataForEditor(initialStudent.metadata ?? null),
  };
}

export function StudentForm({
  submitLabel,
  initialStudent,
  isSubmitting = false,
  errorMessage = null,
  onSubmit,
  onCancel,
}: StudentFormProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(initialStudent));
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildInitialState(initialStudent));
    setValidationError(null);
  }, [initialStudent]);

  const canSubmit = useMemo(() => {
    return !isSubmitting;
  }, [isSubmitting]);

  const updateField = (field: keyof FormState, value: string): void => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const submit = async (): Promise<void> => {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const notes = form.notes.trim();
    const metadataText = form.metadata.trim();

    if (firstName.length === 0 || lastName.length === 0) {
      setValidationError("First name and last name are required.");
      return;
    }

    if (firstName.length > 100 || lastName.length > 100) {
      setValidationError("First name and last name must be 100 characters or fewer.");
      return;
    }

    if (email.length > 255) {
      setValidationError("Email must be 255 characters or fewer.");
      return;
    }

    if (email.length > 0 && !isValidEmail(email)) {
      setValidationError("Enter a valid email address.");
      return;
    }

    if (phone.length > 30) {
      setValidationError("Phone must be 30 characters or fewer.");
      return;
    }

    let parsedMetadata: Record<string, unknown> | null = null;
    if (metadataText.length > 0) {
      try {
        const candidate = JSON.parse(metadataText) as unknown;
        if (!isPlainObject(candidate)) {
          setValidationError("Metadata must be a JSON object.");
          return;
        }

        parsedMetadata = candidate;
      } catch {
        setValidationError("Metadata must be valid JSON.");
        return;
      }
    }

    setValidationError(null);

    await onSubmit({
      firstName,
      lastName,
      email: email.length === 0 ? null : email,
      phone: phone.length === 0 ? null : phone,
      notes: notes.length === 0 ? null : notes,
      metadata: parsedMetadata,
    });
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>First name</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={(value) => {
            updateField("firstName", value);
          }}
          placeholder="First name"
          style={styles.input}
          value={form.firstName}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Last name</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={(value) => {
            updateField("lastName", value);
          }}
          placeholder="Last name"
          style={styles.input}
          value={form.lastName}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={(value) => {
            updateField("email", value);
          }}
          placeholder="student@example.com"
          style={styles.input}
          value={form.email}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          keyboardType="phone-pad"
          onChangeText={(value) => {
            updateField("phone", value);
          }}
          placeholder="+8801XXXXXXXXX"
          style={styles.input}
          value={form.phone}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={(value) => {
            updateField("notes", value);
          }}
          placeholder="Anything important about this student"
          style={[styles.input, styles.textArea]}
          value={form.notes}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Metadata JSON (optional)</Text>
        <TextInput
          multiline
          numberOfLines={6}
          onChangeText={(value) => {
            updateField("metadata", value);
          }}
          placeholder='{"subjects":["Math"]}'
          style={[styles.input, styles.codeArea]}
          value={form.metadata}
        />
      </View>

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.buttonRow}>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            style={[styles.button, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}

        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            void submit();
          }}
          style={[styles.button, styles.primaryButton, !canSubmit && styles.disabledButton]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>{submitLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
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
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: "#0f172a",
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  codeArea: {
    minHeight: 120,
    textAlignVertical: "top",
    fontFamily: "Menlo",
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
  buttonRow: {
    marginTop: 4,
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
