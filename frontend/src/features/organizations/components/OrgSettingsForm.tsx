import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrganizationRequest } from "@tuitioniq/types";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { organizationsMembershipsQueryKey } from "@/src/features/organizations/hooks/useOrgMemberships";
import { organizationsApiClient } from "@/src/features/organizations/services/organizationsApiClient";
import { Button } from "@/src/shared/components/ui/Button";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { colors, radius } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";

const organizationDetailsQueryKey = (organizationId: string) =>
  ["organizations", "detail", organizationId] as const;

type OrgSettingsFormProps = {
  organizationId: string;
  // Pass the already-loaded name so this form initialises correctly on mount (no set-state effect).
  currentName: string;
};

export function OrgSettingsForm({ organizationId, currentName }: OrgSettingsFormProps) {
  const queryClient = useQueryClient();
  const setMemberships = useOrgStore((state) => state.setMemberships);

  const [name, setName] = useState(currentName);
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateOrganizationRequest) =>
      organizationsApiClient.updateOrg(organizationId, payload),
    onSuccess: async (organization) => {
      queryClient.setQueryData(organizationDetailsQueryKey(organization.id), organization);

      const refreshedMemberships = await organizationsApiClient.getMyMemberships();
      setMemberships(refreshedMemberships);
      queryClient.setQueryData(organizationsMembershipsQueryKey, refreshedMemberships);

      setValidationError(null);
    },
  });

  const canSubmit = useMemo(() => {
    const trimmed = name.trim();
    return (
      trimmed.length > 0
      && trimmed.length <= 255
      && trimmed !== currentName
      && !updateMutation.isPending
    );
  }, [name, currentName, updateMutation.isPending]);

  const submit = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setValidationError("Organisation name is required.");
      return;
    }

    if (trimmed.length > 255) {
      setValidationError("Organisation name must be 255 characters or fewer.");
      return;
    }

    setValidationError(null);
    await updateMutation.mutateAsync({ name: trimmed });
  };

  const showSaved = updateMutation.isSuccess && name.trim() === currentName;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Organisation name</Text>
      <TextInput
        onChangeText={setName}
        placeholder="Organisation name"
        style={styles.input}
        value={name}
      />

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
      {updateMutation.isError ? (
        <Text style={styles.errorText}>
          {getApiErrorMessage(updateMutation.error) ?? "Could not update organisation."}
        </Text>
      ) : null}
      {showSaved ? <Text style={styles.successText}>Saved.</Text> : null}

      <Button
        label="Save changes"
        onPress={() => {
          void submit();
        }}
        loading={updateMutation.isPending}
        disabled={!canSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingVertical: 4,
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
    fontSize: 16,
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerFg,
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.action,
  },
});
