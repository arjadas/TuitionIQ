import { Ionicons } from "@expo/vector-icons";
import type { StudentSummaryDto } from "@tuitioniq/types";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useStudents } from "@/src/features/students/hooks/useStudents";
import { Avatar } from "@/src/shared/components/ui/Avatar";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { colors, radius, spacing, typography } from "@/src/shared/theme/tokens";

type StudentPickerProps = {
  orgId: string | null;
  selectedStudentId: string | null;
  onSelect: (student: StudentSummaryDto) => void;
  label?: string;
};

function fullName(student: StudentSummaryDto): string {
  return [student.firstName, student.lastName].filter(Boolean).join(" ").trim() || "Unnamed student";
}

/**
 * Searchable, paginated student selector shared by the Payment Tracker and the
 * Payment Submission portal. Wraps the existing useStudents infinite query so it
 * inherits the same search/status semantics used elsewhere in the app.
 */
export function StudentPicker({
  orgId,
  selectedStudentId,
  onSelect,
  label = "Student",
}: StudentPickerProps) {
  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({ search, status: "Active" as const, pageSize: 20 }), [search]);
  const studentsQuery = useStudents(orgId, filters);

  const students = useMemo(
    () => studentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [studentsQuery.data],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          autoCapitalize="none"
          onChangeText={setSearch}
          placeholder="Search students by name"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={search}
        />
      </View>

      {studentsQuery.isPending ? (
        <View style={styles.stateRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading students…</Text>
        </View>
      ) : null}

      {studentsQuery.isError ? (
        <Text style={styles.errorText}>
          {getApiErrorMessage(studentsQuery.error) ?? "Could not load students."}
        </Text>
      ) : null}

      {!studentsQuery.isPending && !studentsQuery.isError && students.length === 0 ? (
        <View style={styles.stateRow}>
          <Text style={styles.stateText}>
            {search.trim().length > 0 ? "No students match your search." : "No active students yet."}
          </Text>
        </View>
      ) : null}

      {students.length > 0 ? (
        <View style={styles.list}>
          {students.map((student) => {
            const isSelected = selectedStudentId === student.id;
            return (
              <Pressable
                key={student.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(student)}
                style={[styles.row, isSelected && styles.rowSelected]}
              >
                <Avatar name={fullName(student)} size={32} />
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={styles.rowName}>
                    {fullName(student)}
                  </Text>
                  {student.email ? (
                    <Text numberOfLines={1} style={styles.rowMeta}>
                      {student.email}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                )}
              </Pressable>
            );
          })}

          {studentsQuery.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              disabled={studentsQuery.isFetchingNextPage}
              onPress={() => {
                void studentsQuery.fetchNextPage();
              }}
              style={styles.loadMore}
            >
              {studentsQuery.isFetchingNextPage ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Load more students</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textLabel,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stateText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerFg,
  },
  list: {
    gap: spacing.sm,
    maxHeight: 320,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.avatarBg,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  loadMore: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
});
