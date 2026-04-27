import { StyleSheet, Text, View } from "react-native";

type AccountStatusBadgeProps = {
  accountStatus: string;
};

type NormalizedAccountStatus = "no_account" | "invite_pending" | "active" | "unknown";

function normalizeAccountStatus(value: string): NormalizedAccountStatus {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, "");

  if (normalized === "noaccount") {
    return "no_account";
  }

  if (normalized === "invitepending") {
    return "invite_pending";
  }

  if (normalized === "active") {
    return "active";
  }

  return "unknown";
}

function getLabel(status: NormalizedAccountStatus): string {
  switch (status) {
    case "no_account":
      return "No Account";
    case "invite_pending":
      return "Invite Pending";
    case "active":
      return "Active";
    default:
      return "Unknown";
  }
}

export function AccountStatusBadge({ accountStatus }: AccountStatusBadgeProps) {
  const status = normalizeAccountStatus(accountStatus);

  return (
    <View
      style={[
        styles.badge,
        status === "no_account" && styles.noAccountBadge,
        status === "invite_pending" && styles.invitePendingBadge,
        status === "active" && styles.activeBadge,
        status === "unknown" && styles.unknownBadge,
      ]}
    >
      <Text
        style={[
          styles.text,
          status === "no_account" && styles.noAccountText,
          status === "invite_pending" && styles.invitePendingText,
          status === "active" && styles.activeText,
          status === "unknown" && styles.unknownText,
        ]}
      >
        {getLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
  noAccountBadge: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
  },
  noAccountText: {
    color: "#475569",
  },
  invitePendingBadge: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  invitePendingText: {
    color: "#9a3412",
  },
  activeBadge: {
    backgroundColor: "#ecfdf3",
    borderColor: "#86efac",
  },
  activeText: {
    color: "#166534",
  },
  unknownBadge: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  unknownText: {
    color: "#991b1b",
  },
});
