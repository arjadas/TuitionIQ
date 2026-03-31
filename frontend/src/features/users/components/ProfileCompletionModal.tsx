import { useMutation } from "@tanstack/react-query";
import type { UpdateProfileRequest, UserProfileDto } from "@tuitioniq/types";
import { apiClient } from "@/src/lib/apiClient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type ProfileCompletionModalProps = {
  visible: boolean;
  initialFirstName?: string;
  initialLastName?: string;
  initialPhone?: string | null;
  onCompleted: (profile: UserProfileDto) => void;
};

async function updateProfile(request: UpdateProfileRequest): Promise<UserProfileDto> {
  const { data } = await apiClient.patch<UserProfileDto>("/api/users/profile", request);
  return data;
}

export function ProfileCompletionModal({
  visible,
  initialFirstName = "",
  initialLastName = "",
  initialPhone = null,
  onCompleted,
}: ProfileCompletionModalProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setFirstName(initialFirstName);
    setLastName(initialLastName);
    setPhone(initialPhone ?? "");
  }, [initialFirstName, initialLastName, initialPhone, visible]);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      setValidationError(null);
      onCompleted(profile);
    },
  });

  const canSubmit = useMemo(() => {
    return firstName.trim().length > 0 && lastName.trim().length > 0 && !mutation.isPending;
  }, [firstName, lastName, mutation.isPending]);

  const submit = async (): Promise<void> => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setValidationError("First name and last name are required.");
      return;
    }

    setValidationError(null);

    const payload: UpdateProfileRequest = {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      phone: trimmedPhone.length === 0 ? null : trimmedPhone,
    };

    await mutation.mutateAsync(payload);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
      }}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>
            Add your details before continuing to your organization workspace.
          </Text>
        </View>

        <View style={styles.formBlock}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              onChangeText={setFirstName}
              placeholder="First name"
              style={styles.input}
              value={firstName}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              onChangeText={setLastName}
              placeholder="Last name"
              style={styles.input}
              value={lastName}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="Phone"
              style={styles.input}
              value={phone}
            />
          </View>

          {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          {mutation.isError ? (
            <Text style={styles.errorText}>
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Could not save your profile. Please try again."}
            </Text>
          ) : null}

          <Pressable
            disabled={!canSubmit}
            onPress={() => {
              void submit();
            }}
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Save and continue</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerBlock: {
    marginTop: 18,
    marginBottom: 22,
    gap: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  formBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 14,
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
    fontSize: 16,
    color: "#0f172a",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
  submitButton: {
    marginTop: 6,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
});
