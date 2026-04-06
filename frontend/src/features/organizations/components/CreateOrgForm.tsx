import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrganizationRequest } from "@tuitioniq/types";
import { AxiosError } from "axios";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { organizationsMembershipsQueryKey } from "@/src/features/organizations/hooks/useOrgMemberships";
import { organizationsApiClient } from "@/src/features/organizations/services/organizationsApiClient";
import { useOrgStore } from "@/src/store/orgStore";

const slugPattern = /^[a-z0-9-]+$/;

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function getMutationErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data;
    if (typeof responseData === "object" && responseData !== null) {
      const problemDetails = responseData as Record<string, unknown>;

      if (typeof problemDetails.detail === "string" && problemDetails.detail.trim().length > 0) {
        return problemDetails.detail;
      }

      if (typeof problemDetails.title === "string" && problemDetails.title.trim().length > 0) {
        return problemDetails.title;
      }
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Could not create organization. Please try again.";
}

export function CreateOrgForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectOrg = useOrgStore((state) => state.selectOrg);
  const setMemberships = useOrgStore((state) => state.setMemberships);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hasEditedSlug, setHasEditedSlug] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: organizationsApiClient.createOrg,
    onSuccess: async (organization) => {
      const memberships = await organizationsApiClient.getMyMemberships();
      setMemberships(memberships);
      queryClient.setQueryData(organizationsMembershipsQueryKey, memberships);

      const createdMembership = memberships.find((membership) => membership.organizationId === organization.id);
      selectOrg(createdMembership?.organizationId ?? organization.id);

      await queryClient.invalidateQueries({
        queryKey: organizationsMembershipsQueryKey,
      });

      router.replace("/dashboard" as Href);
    },
  });

  const canSubmit = useMemo(() => {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    return (
      trimmedName.length > 0
      && trimmedName.length <= 255
      && trimmedSlug.length > 0
      && trimmedSlug.length <= 100
      && slugPattern.test(trimmedSlug)
      && !mutation.isPending
    );
  }, [mutation.isPending, name, slug]);

  const onNameChanged = (value: string): void => {
    setName(value);

    if (!hasEditedSlug) {
      setSlug(toSlug(value));
    }
  };

  const onSlugChanged = (value: string): void => {
    setHasEditedSlug(true);
    setSlug(toSlug(value));
  };

  const submit = async (): Promise<void> => {
    const trimmedName = name.trim();
    const normalizedSlug = slug.trim().toLowerCase();

    if (trimmedName.length === 0) {
      setValidationError("Organization name is required.");
      return;
    }

    if (trimmedName.length > 255) {
      setValidationError("Organization name must be 255 characters or fewer.");
      return;
    }

    if (normalizedSlug.length === 0) {
      setValidationError("Slug is required.");
      return;
    }

    if (normalizedSlug.length > 100) {
      setValidationError("Slug must be 100 characters or fewer.");
      return;
    }

    if (!slugPattern.test(normalizedSlug)) {
      setValidationError("Slug can only include lowercase letters, numbers, and hyphens.");
      return;
    }

    setValidationError(null);

    const payload: CreateOrganizationRequest = {
      name: trimmedName,
      slug: normalizedSlug,
    };

    await mutation.mutateAsync(payload);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Create your organization</Text>
      <Text style={styles.subtitle}>
        You can update organization settings later from the admin area.
      </Text>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Organization name</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={onNameChanged}
          placeholder="Sunrise Learning Centre"
          style={styles.input}
          value={name}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Slug</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onSlugChanged}
          placeholder="sunrise-learning"
          style={styles.input}
          value={slug}
        />
        <Text style={styles.hint}>Used in URLs. Lowercase letters, numbers, and hyphens only.</Text>
      </View>

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
      {mutation.isError ? (
        <Text style={styles.errorText}>
          {getMutationErrorMessage(mutation.error)}
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
          <Text style={styles.submitButtonText}>Create organization</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
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
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: "#0f172a",
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 12,
    minHeight: 48,
    backgroundColor: "#1d4ed8",
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
