import type { StudentSummaryDto } from "@tuitioniq/types";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { StudentCard } from "@/src/features/students/components/StudentCard";
import { type StudentsFilters, useStudents } from "@/src/features/students/hooks/useStudents";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";

type StudentListProps = {
  orgId: string | null;
  filters: StudentsFilters;
  onSelectStudent?: (student: StudentSummaryDto) => void;
};

export function StudentList({ orgId, filters, onSelectStudent }: StudentListProps) {
  const studentsQuery = useStudents(orgId, filters);

  const students = useMemo(() => {
    if (!studentsQuery.data) {
      return [];
    }

    return studentsQuery.data.pages.flatMap((page) => page.items);
  }, [studentsQuery.data]);

  const onLoadMore = (): void => {
    if (!studentsQuery.hasNextPage || studentsQuery.isFetchingNextPage) {
      return;
    }

    void studentsQuery.fetchNextPage();
  };

  if (!orgId) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No organization selected</Text>
        <Text style={styles.stateBody}>Select an organization before viewing students.</Text>
      </View>
    );
  }

  if (studentsQuery.isPending) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#1d4ed8" />
        <Text style={styles.stateBody}>Loading students...</Text>
      </View>
    );
  }

  if (studentsQuery.isError) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Could not load students</Text>
        <Text style={styles.stateBody}>
          {getApiErrorMessage(studentsQuery.error) ?? "Please try again."}
        </Text>
      </View>
    );
  }

  if (students.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No students found</Text>
        <Text style={styles.stateBody}>Adjust your filters or create a new student.</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={students}
      keyExtractor={(item) => item.id}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      onRefresh={() => {
        void studentsQuery.refetch();
      }}
      refreshing={studentsQuery.isRefetching && !studentsQuery.isFetchingNextPage}
      renderItem={({ item }) => (
        <StudentCard
          onPress={onSelectStudent}
          student={item}
        />
      )}
      ListFooterComponent={studentsQuery.isFetchingNextPage ? <ActivityIndicator color="#1d4ed8" /> : null}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  centerState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
  },
});
