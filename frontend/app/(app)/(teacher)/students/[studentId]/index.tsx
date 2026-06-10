import type { CreateStudentRequest, SetFeeRequest, UpdateStudentRequest } from "@tuitioniq/types";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SetFeeForm } from "@/src/features/billing/components/SetFeeForm";
import { useFeeHistory } from "@/src/features/billing/hooks/useFeeHistory";
import { useSetFee } from "@/src/features/billing/hooks/useFeePeriods";
import { AccountStatusBadge } from "@/src/features/students/components/AccountStatusBadge";
import { StudentForm } from "@/src/features/students/components/StudentForm";
import { useStudent } from "@/src/features/students/hooks/useStudent";
import { useDeleteStudent, useUpdateStudent } from "@/src/features/students/hooks/useStudents";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { formatCurrency } from "@/src/shared/utils/formatCurrency";
import { useOrgStore } from "@/src/store/orgStore";

function resolveStudentId(input: string | string[] | undefined): string | null {
  if (!input) {
    return null;
  }

  if (Array.isArray(input)) {
    return input[0] ?? null;
  }

  return input;
}

function formatDate(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

export default function StudentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string | string[] }>();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);

  const studentId = useMemo(() => resolveStudentId(params.studentId), [params.studentId]);
  const studentQuery = useStudent(selectedOrgId, studentId);
  const updateStudentMutation = useUpdateStudent(selectedOrgId);
  const deleteStudentMutation = useDeleteStudent(selectedOrgId);
  const feeHistoryQuery = useFeeHistory(studentId);
  const setFeeMutation = useSetFee(studentId);

  const [isEditing, setIsEditing] = useState(false);
  const [showSetFeeForm, setShowSetFeeForm] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const save = async (payload: CreateStudentRequest): Promise<void> => {
    if (!studentId) {
      throw new Error("Student id is missing.");
    }

    const updatePayload: UpdateStudentRequest = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      notes: payload.notes,
      metadata: payload.metadata,
    };

    await updateStudentMutation.mutateAsync({
      studentId,
      body: updatePayload,
    });

    setIsEditing(false);
  };

  const submitSetFee = async (payload: SetFeeRequest): Promise<void> => {
    await setFeeMutation.mutateAsync(payload);
    setShowSetFeeForm(false);
  };

  const confirmDelete = (): void => {
    if (!studentId) {
      return;
    }

    Alert.alert(
      "Delete student",
      "This student will be soft-deleted and hidden from active lists.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeleteErrorMessage(null);
                await deleteStudentMutation.mutateAsync({ studentId });
                router.replace("/(app)/(teacher)/students" as Href);
              } catch (error) {
                setDeleteErrorMessage(getApiErrorMessage(error) ?? "Could not delete student.");
              }
            })();
          },
        },
      ],
    );
  };

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Student Detail</Text>
          <Text style={styles.bodyText}>Select an organization first from Home.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!studentId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Student Detail</Text>
          <Text style={styles.bodyText}>Student id is missing.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (studentQuery.isPending) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#1d4ed8" />
          <Text style={styles.bodyText}>Loading student profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (studentQuery.isError || !studentQuery.data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Could not load student</Text>
          <Text style={styles.bodyText}>
            {getApiErrorMessage(studentQuery.error) ?? "Please try again."}
          </Text>
          <Pressable
            onPress={() => {
              router.replace("/(app)/(teacher)/students" as Href);
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Back to list</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const student = studentQuery.data;
  const activeFee = feeHistoryQuery.data?.find((fee) => fee.isActive) ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{student.firstName} {student.lastName}</Text>
              <Text style={styles.bodyText}>{student.email ?? "No email provided"}</Text>
            </View>

            <View style={styles.statusWrap}>
              <AccountStatusBadge accountStatus={student.accountStatus} />
            </View>
          </View>

          <View style={styles.metaList}>
            <Text style={styles.metaItem}>Status: {student.status}</Text>
            <Text style={styles.metaItem}>Phone: {student.phone ?? "Not set"}</Text>
            <Text style={styles.metaItem}>Created: {formatDate(student.createdAt)}</Text>
            <Text style={styles.metaItem}>Updated: {formatDate(student.updatedAt)}</Text>
            <Text style={styles.metaItem}>Notes: {student.notes ?? "None"}</Text>
            <Text style={styles.metaItem}>
              Metadata: {student.metadata ? JSON.stringify(student.metadata) : "{}"}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => {
                router.push(`/(app)/(teacher)/students/${studentId}/periods` as Href);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Fee periods</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setIsEditing((current) => !current);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{isEditing ? "Stop editing" : "Edit"}</Text>
            </Pressable>

            <Pressable
              disabled={deleteStudentMutation.isPending}
              onPress={confirmDelete}
              style={[styles.dangerButton, deleteStudentMutation.isPending && styles.disabledButton]}
            >
              {deleteStudentMutation.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.dangerButtonText}>Delete</Text>
              )}
            </Pressable>
          </View>

          {deleteErrorMessage ? <Text style={styles.errorText}>{deleteErrorMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Fee configuration</Text>
            <Pressable
              onPress={() => {
                setShowSetFeeForm((current) => !current);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {showSetFeeForm ? "Close" : "Set / update fee"}
              </Text>
            </Pressable>
          </View>

          {feeHistoryQuery.isPending ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color="#1d4ed8" />
              <Text style={styles.bodyText}>Loading fee configuration...</Text>
            </View>
          ) : null}

          {feeHistoryQuery.isError ? (
            <Text style={styles.errorText}>
              {getApiErrorMessage(feeHistoryQuery.error) ?? "Could not load fee configuration."}
            </Text>
          ) : null}

          {!feeHistoryQuery.isPending && !feeHistoryQuery.isError ? (
            activeFee ? (
              <View style={styles.metaList}>
                <Text style={styles.metaItem}>Source: {activeFee.feeSource}</Text>
                <Text style={styles.metaItem}>
                  Amount:{" "}
                  {activeFee.manualFee != null
                    ? formatCurrency(activeFee.manualFee, activeFee.currency)
                    : "Calculated"}
                </Text>
                <Text style={styles.metaItem}>Effective from: {activeFee.effectiveFrom}</Text>
                {activeFee.notes ? <Text style={styles.metaItem}>Notes: {activeFee.notes}</Text> : null}
              </View>
            ) : (
              <Text style={styles.bodyText}>No active fee configured.</Text>
            )
          ) : null}

          {showSetFeeForm ? (
            <SetFeeForm
              errorMessage={
                setFeeMutation.isError
                  ? (getApiErrorMessage(setFeeMutation.error) ?? "Could not set fee.")
                  : null
              }
              isSubmitting={setFeeMutation.isPending}
              onCancel={() => {
                setShowSetFeeForm(false);
              }}
              onSubmit={submitSetFee}
              submitLabel="Save fee"
            />
          ) : null}
        </View>

        {isEditing ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Edit Student</Text>
            <StudentForm
              errorMessage={
                updateStudentMutation.isError
                  ? (getApiErrorMessage(updateStudentMutation.error) ?? "Could not update student.")
                  : null
              }
              initialStudent={student}
              isSubmitting={updateStudentMutation.isPending}
              onCancel={() => {
                setIsEditing(false);
              }}
              onSubmit={save}
              submitLabel="Save changes"
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  contentContainer: {
    padding: 16,
    gap: 12,
  },
  centerState: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusWrap: {
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  inlineState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bodyText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
  metaList: {
    gap: 4,
  },
  metaItem: {
    fontSize: 13,
    color: "#334155",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 2,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  dangerButton: {
    borderRadius: 12,
    backgroundColor: "#b91c1c",
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
