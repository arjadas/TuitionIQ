import type { StudentSummaryDto } from "@tuitioniq/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AccountStatusBadge } from "@/src/features/students/components/AccountStatusBadge";

type StudentCardProps = {
  student: StudentSummaryDto;
  onPress?: (student: StudentSummaryDto) => void;
};

function getStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === "active") {
    return "Active";
  }

  if (normalized === "inactive") {
    return "Inactive";
  }

  if (normalized === "graduated") {
    return "Graduated";
  }

  return status;
}

function formatCreatedAt(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString();
}

export function StudentCard({ student, onPress }: StudentCardProps) {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const statusLabel = getStatusLabel(student.status);

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        onPress?.(student);
      }}
      style={({ pressed }) => [styles.card, pressed && Boolean(onPress) && styles.cardPressed]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.name}>{fullName.length > 0 ? fullName : "Unnamed student"}</Text>
          <Text style={styles.email}>{student.email ?? "No email"}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            statusLabel === "Active" && styles.activeStatus,
            statusLabel === "Inactive" && styles.inactiveStatus,
            statusLabel === "Graduated" && styles.graduatedStatus,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              statusLabel === "Active" && styles.activeStatusText,
              statusLabel === "Inactive" && styles.inactiveStatusText,
              statusLabel === "Graduated" && styles.graduatedStatusText,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <AccountStatusBadge accountStatus={student.accountStatus} />
        <Text style={styles.createdAt}>Created {formatCreatedAt(student.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  cardPressed: {
    opacity: 0.75,
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
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  email: {
    fontSize: 13,
    color: "#64748b",
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  activeStatus: {
    borderColor: "#86efac",
    backgroundColor: "#ecfdf3",
  },
  activeStatusText: {
    color: "#166534",
  },
  inactiveStatus: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  inactiveStatusText: {
    color: "#475569",
  },
  graduatedStatus: {
    borderColor: "#c4b5fd",
    backgroundColor: "#f5f3ff",
  },
  graduatedStatusText: {
    color: "#5b21b6",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  createdAt: {
    fontSize: 12,
    color: "#64748b",
  },
});
