import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrganizationRequest } from "@tuitioniq/types";
import { AxiosError } from "axios";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  organizationsMembershipsQueryKey,
  useOrgMemberships,
} from "@/src/features/organizations/hooks/useOrgMemberships";
import { organizationsApiClient } from "@/src/features/organizations/services/organizationsApiClient";
import { useOrgStore } from "@/src/store/orgStore";

const organizationDetailsQueryKey = (organizationId: string | null) =>
  ["organizations", "detail", organizationId] as const;

function getErrorMessage(error: unknown, fallbackMessage: string): string {
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

  return fallbackMessage;
}

function formatDate(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString();
}

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const selectOrg = useOrgStore((state) => state.selectOrg);
  const setMemberships = useOrgStore((state) => state.setMemberships);

  const membershipsQuery = useOrgMemberships();
  const memberships = useMemo(() => membershipsQuery.data ?? [], [membershipsQuery.data]);

  const [name, setName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!membershipsQuery.isSuccess || selectedOrgId) {
      return;
    }

    if (memberships.length === 1) {
      selectOrg(memberships[0].organizationId);
      return;
    }

    if (memberships.length > 1) {
      router.replace("/home" as Href);
    }
  }, [memberships, membershipsQuery.isSuccess, router, selectOrg, selectedOrgId]);

  const selectedMembership = useMemo(() => {
    if (!selectedOrgId) {
      return null;
    }

    return memberships.find((membership) => membership.organizationId === selectedOrgId) ?? null;
  }, [memberships, selectedOrgId]);

  const organizationQuery = useQuery({
    queryKey: organizationDetailsQueryKey(selectedOrgId),
    queryFn: () => organizationsApiClient.getOrg(selectedOrgId!),
    enabled: Boolean(selectedOrgId),
  });

  useEffect(() => {
    if (organizationQuery.data) {
      setName(organizationQuery.data.name);
    }
  }, [organizationQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateOrganizationRequest) => {
      if (!selectedOrgId) {
        throw new Error("No organization is selected.");
      }

      return organizationsApiClient.updateOrg(selectedOrgId, payload);
    },
    onSuccess: async (organization) => {
      queryClient.setQueryData(organizationDetailsQueryKey(organization.id), organization);

      const refreshedMemberships = await organizationsApiClient.getMyMemberships();
      setMemberships(refreshedMemberships);
      queryClient.setQueryData(organizationsMembershipsQueryKey, refreshedMemberships);

      await queryClient.invalidateQueries({
        queryKey: organizationsMembershipsQueryKey,
      });

      setValidationError(null);
    },
  });

  const canSubmit = useMemo(() => {
    const trimmedName = name.trim();
    const currentName = organizationQuery.data?.name ?? "";

    return (
      trimmedName.length > 0
      && trimmedName.length <= 255
      && trimmedName !== currentName
      && !updateMutation.isPending
    );
  }, [name, organizationQuery.data?.name, updateMutation.isPending]);

  const submit = async (): Promise<void> => {
    const trimmedName = name.trim();

    if (!selectedOrgId) {
      setValidationError("Select an organization before updating.");
      return;
    }

    if (trimmedName.length === 0) {
      setValidationError("Organization name is required.");
      return;
    }

    if (trimmedName.length > 255) {
      setValidationError("Organization name must be 255 characters or fewer.");
      return;
    }

    setValidationError(null);
    await updateMutation.mutateAsync({ name: trimmedName });
  };

  const isLoading = membershipsQuery.isPending || (Boolean(selectedOrgId) && organizationQuery.isPending);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator color="#1d4ed8" size="large" />
          <Text style={styles.subtitle}>Loading organization details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (membershipsQuery.isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.errorText}>
            {getErrorMessage(membershipsQuery.error, "Could not load memberships.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (membershipsQuery.isSuccess && memberships.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>You do not have an organization yet.</Text>
          <Pressable
            onPress={() => {
              router.push("/organizations/create" as Href);
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Create organization</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Select an organization to continue.</Text>
          <Pressable
            onPress={() => {
              router.replace("/home" as Href);
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Go to home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (organizationQuery.isError || !organizationQuery.data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.errorText}>
            {getErrorMessage(organizationQuery.error, "Could not load organization details.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Selected organization: {organizationQuery.data.name}</Text>

        <View style={styles.metaList}>
          <Text style={styles.metaItem}>Slug: {organizationQuery.data.slug}</Text>
          <Text style={styles.metaItem}>Plan: {organizationQuery.data.plan}</Text>
          <Text style={styles.metaItem}>Joined as: {selectedMembership?.role ?? "Member"}</Text>
          <Text style={styles.metaItem}>Created: {formatDate(organizationQuery.data.createdAt)}</Text>
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>Organization name</Text>
          <TextInput
            onChangeText={setName}
            placeholder="Organization name"
            style={styles.input}
            value={name}
          />

          {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          {updateMutation.isError ? (
            <Text style={styles.errorText}>
              {getErrorMessage(updateMutation.error, "Could not update organization.")}
            </Text>
          ) : null}

          <Pressable
            disabled={!canSubmit}
            onPress={() => {
              void submit();
            }}
            style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Update organization</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  metaList: {
    gap: 4,
  },
  metaItem: {
    fontSize: 13,
    color: "#334155",
  },
  formBlock: {
    gap: 8,
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
  primaryButton: {
    borderRadius: 12,
    minHeight: 46,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
});
