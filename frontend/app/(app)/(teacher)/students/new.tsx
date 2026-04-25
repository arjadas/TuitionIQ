import type { CreateStudentRequest } from "@tuitioniq/types";
import { type Href, useRouter } from "expo-router";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StudentForm } from "@/src/features/students/components/StudentForm";
import { useCreateStudent } from "@/src/features/students/hooks/useStudents";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { useOrgStore } from "@/src/store/orgStore";

export default function NewStudentScreen() {
  const router = useRouter();
  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const createStudentMutation = useCreateStudent(selectedOrgId);

  const submit = async (payload: CreateStudentRequest): Promise<void> => {
    const createdStudent = await createStudentMutation.mutateAsync(payload);
    router.replace(`/(app)/(teacher)/students/${createdStudent.id}` as Href);
  };

  if (!selectedOrgId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Create Student</Text>
          <Text style={styles.bodyText}>Select an organization first from Home.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Student</Text>
        <Text style={styles.bodyText}>Add profile details and save to your organization.</Text>

        <StudentForm
          errorMessage={
            createStudentMutation.isError
              ? (getApiErrorMessage(createStudentMutation.error) ?? "Could not create student.")
              : null
          }
          isSubmitting={createStudentMutation.isPending}
          onCancel={() => {
            router.replace("/(app)/(teacher)/students" as Href);
          }}
          onSubmit={submit}
          submitLabel="Create student"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    padding: 16,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
});
