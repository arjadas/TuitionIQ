import type { StudentSummaryDto } from "@tuitioniq/types";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountStatusBadge } from "@/src/features/students/components/AccountStatusBadge";
import { useStudents } from "@/src/features/students/hooks/useStudents";
import { Button } from "@/src/shared/components/ui/Button";
import { Card } from "@/src/shared/components/ui/Card";
import { getApiErrorMessage } from "@/src/shared/utils/apiError";
import { colors, radius, spacing } from "@/src/shared/theme/tokens";

// Dashboard shows a short preview of the roster; the full paginated list lives on the Students screen.
const PREVIEW_PAGE_SIZE = 5;

type OrgStudentsCardProps = {
  orgId: string | null;
  onAddStudent: () => void;
  onSelectStudent: (studentId: string) => void;
  onSeeAll: () => void;
};

export function OrgStudentsCard({
  orgId,
  onAddStudent,
  onSelectStudent,
  onSeeAll,
}: OrgStudentsCardProps) {
  const filters = useMemo(() => ({ pageSize: PREVIEW_PAGE_SIZE }), []);
  const studentsQuery = useStudents(orgId, filters);

  const students = useMemo<StudentSummaryDto[]>(
    () => studentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [studentsQuery.data],
  );

  const totalCount = studentsQuery.data?.pages[0]?.totalCount ?? null;

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text style={styles.title}>Students</Text>
          {totalCount !== null ? (
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{totalCount}</Text>
            </View>
          ) : null}
        </View>
        {students.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={onSeeAll}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      {studentsQuery.isPending ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateBody}>Loading students...</Text>
        </View>
      ) : null}

      {studentsQuery.isError ? (
        <Text style={styles.errorText}>
          {getApiErrorMessage(studentsQuery.error) ?? "Could not load students."}
        </Text>
      ) : null}

      {!studentsQuery.isPending && !studentsQuery.isError && students.length === 0 ? (
        <View style={styles.stateBlock}>
          <Text style={styles.emptyTitle}>No students yet</Text>
          <Text style={styles.stateBody}>Add your first student to get started.</Text>
        </View>
      ) : null}

      {!studentsQuery.isError && students.length > 0 ? (
        <View style={styles.list}>
          {students.map((student) => (
            <StudentRow key={student.id} onPress={onSelectStudent} student={student} />
          ))}
        </View>
      ) : null}

      <Button label="+ Add student" onPress={onAddStudent} variant="primary" />
    </Card>
  );
}

type StudentRowProps = {
  student: StudentSummaryDto;
  onPress: (studentId: string) => void;
};

function StudentRow({ student, onPress }: StudentRowProps) {
  const isActive = student.status.trim().toLowerCase() === "active";
  const fullName = `${student.firstName} ${student.lastName}`.trim();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onPress(student.id);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]} />
      <View style={styles.rowInfo}>
        <Text numberOfLines={1} style={styles.rowName}>
          {fullName.length > 0 ? fullName : "Unnamed student"}
        </Text>
        <Text numberOfLines={1} style={styles.rowEmail}>
          {student.email ?? "No email"}
        </Text>
      </View>
      <AccountStatusBadge accountStatus={student.accountStatus} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  countChip: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  countChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.75,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  dotActive: {
    backgroundColor: "#22C55E",
  },
  dotInactive: {
    backgroundColor: colors.border,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rowEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  stateBlock: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  stateBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerFg,
  },
});
