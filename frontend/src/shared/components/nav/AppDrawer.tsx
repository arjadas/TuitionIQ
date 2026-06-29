import { Ionicons } from "@expo/vector-icons";
import { type Href, usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { authService } from "@/src/features/auth/services/authService";
import { useOrgMemberships } from "@/src/features/organizations/hooks/useOrgMemberships";
import { useStudents } from "@/src/features/students/hooks/useStudents";
import { useCurrentUser } from "@/src/features/users/hooks/useCurrentUser";
import { forceClientSignOut } from "@/src/lib/forceClientSignOut";
import { resetClientSessionState } from "@/src/lib/resetClientSessionState";
import { Avatar } from "@/src/shared/components/ui/Avatar";
import { colors, radius } from "@/src/shared/theme/tokens";
import { useOrgStore } from "@/src/store/orgStore";
import { useUiStore } from "@/src/store/uiStore";

type DrawerVariant = "sidebar" | "overlay";
type IconName = keyof typeof Ionicons.glyphMap;

type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
  route: Href;
  isActive: (pathname: string) => boolean;
  group: "navigate" | "configure" | "support";
  badge?: "students";
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "grid-outline",
    iconActive: "grid",
    route: "/dashboard" as Href,
    isActive: (pathname) => pathname === "/dashboard",
    group: "navigate",
  },
  {
    key: "students",
    label: "Students",
    icon: "people-outline",
    iconActive: "people",
    route: "/(app)/(teacher)/students" as Href,
    isActive: (pathname) => pathname.startsWith("/students"),
    group: "navigate",
    badge: "students",
  },
  {
    key: "billing",
    label: "Billing",
    icon: "receipt-outline",
    iconActive: "receipt",
    route: "/billing" as Href,
    isActive: (pathname) =>
      pathname === "/billing" ||
      (pathname.startsWith("/billing/") &&
        !pathname.startsWith("/billing/tracker") &&
        !pathname.startsWith("/billing/record")),
    group: "navigate",
  },
  {
    key: "payment-tracker",
    label: "Payment Tracker",
    icon: "calendar-outline",
    iconActive: "calendar",
    route: "/billing/tracker" as Href,
    isActive: (pathname) => pathname.startsWith("/billing/tracker"),
    group: "navigate",
  },
  {
    key: "record-payment",
    label: "Record Payment",
    icon: "cash-outline",
    iconActive: "cash",
    route: "/billing/record" as Href,
    isActive: (pathname) => pathname.startsWith("/billing/record"),
    group: "navigate",
  },
  {
    key: "settings",
    label: "Org settings",
    icon: "settings-outline",
    iconActive: "settings",
    route: "/settings" as Href,
    isActive: (pathname) => pathname === "/settings",
    group: "configure",
  },
  {
    key: "help",
    label: "Help & docs",
    icon: "help-circle-outline",
    iconActive: "help-circle",
    route: "/help" as Href,
    isActive: (pathname) => pathname === "/help",
    group: "support",
  },
];

const GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "navigate", label: "Navigate" },
  { key: "configure", label: "Configure" },
  { key: "support", label: "Support" },
];

function titleCase(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function AppDrawer({ variant }: { variant: DrawerVariant }) {
  const router = useRouter();
  const pathname = usePathname();

  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const closeDrawer = useUiStore((state) => state.closeDrawer);

  const collapsed = variant === "sidebar" && sidebarCollapsed;

  const selectedOrgId = useOrgStore((state) => state.selectedOrgId);
  const membershipsQuery = useOrgMemberships();
  const selectedMembership =
    membershipsQuery.data?.find((membership) => membership.organizationId === selectedOrgId) ?? null;

  const studentsQuery = useStudents(selectedOrgId, { pageSize: 1 });
  const studentCount = studentsQuery.data?.pages[0]?.totalCount ?? null;

  const { data: currentUser } = useCurrentUser();
  const userFullName = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ").trim();

  const [flyoutOpen, setFlyoutOpen] = useState(false);

  const navigateTo = (route: Href): void => {
    setFlyoutOpen(false);
    closeDrawer();
    router.push(route);
  };

  const handleChangePassword = (): void => {
    setFlyoutOpen(false);
    closeDrawer();
    const email = currentUser?.email;
    if (!email) {
      return;
    }

    void authService.resetPasswordForEmail(email);
    Alert.alert("Check your email", `We've sent a password reset link to ${email}.`);
  };

  const handleSignOut = (): void => {
    setFlyoutOpen(false);
    closeDrawer();
    void forceClientSignOut();
  };

  const handleSignOutEverywhere = (): void => {
    setFlyoutOpen(false);
    Alert.alert(
      "Sign out everywhere",
      "This signs you out on every device and browser. You'll need to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out everywhere",
          style: "destructive",
          onPress: () => {
            closeDrawer();
            void (async () => {
              await authService.signOutEverywhere();
              resetClientSessionState();
            })();
          },
        },
      ],
    );
  };

  const renderFlyoutRow = (
    icon: IconName,
    label: string,
    onPress: () => void,
    danger = false,
  ) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.flyoutItem}>
      <Ionicons name={icon} size={15} color={danger ? colors.danger : colors.textSecondary} />
      <Text style={[styles.flyoutText, danger && styles.flyoutTextDanger]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.brandRow, collapsed && styles.brandRowCollapsed]}>
        <View style={styles.brandLeft}>
          <View style={styles.brandMark}>
            <Ionicons name="book" size={15} color={colors.white} />
          </View>
          {!collapsed ? <Text style={styles.brandText}>TuitionIQ</Text> : null}
        </View>
        {variant === "sidebar" ? (
          <Pressable
            accessibilityLabel={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            accessibilityRole="button"
            hitSlop={8}
            onPress={toggleSidebarCollapsed}
            style={styles.iconButton}
          >
            <Ionicons name={collapsed ? "chevron-forward" : "chevron-back"} size={16} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Close menu"
            accessibilityRole="button"
            hitSlop={8}
            onPress={closeDrawer}
            style={styles.iconButton}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigateTo("/home" as Href)}
        style={[styles.orgRow, collapsed && styles.orgRowCollapsed]}
      >
        <Avatar name={selectedMembership?.organization.name ?? "Organisation"} size={26} />
        {!collapsed ? (
          <>
            <View style={styles.orgInfo}>
              <Text numberOfLines={1} style={styles.orgName}>
                {selectedMembership?.organization.name ?? "Select organisation"}
              </Text>
              {selectedMembership ? (
                <Text style={styles.orgRole}>{titleCase(selectedMembership.role)}</Text>
              ) : null}
            </View>
            <Ionicons name="swap-horizontal" size={15} color={colors.textMuted} />
          </>
        ) : null}
      </Pressable>

      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navContent}>
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.key);
          return (
            <View key={group.key} style={styles.navGroup}>
              {collapsed ? (
                <View style={styles.groupGap} />
              ) : (
                <Text style={styles.groupLabel}>{group.label}</Text>
              )}
              {items.map((item) => {
                const active = item.isActive(pathname);
                const badgeValue = item.badge === "students" ? studentCount : null;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    onPress={() => navigateTo(item.route)}
                    style={[
                      styles.navItem,
                      collapsed && styles.navItemCollapsed,
                      active && styles.navItemActive,
                    ]}
                  >
                    <Ionicons
                      name={active ? item.iconActive : item.icon}
                      size={18}
                      color={active ? colors.primary : colors.textSecondary}
                    />
                    {!collapsed ? (
                      <Text numberOfLines={1} style={[styles.navLabel, active && styles.navLabelActive]}>
                        {item.label}
                      </Text>
                    ) : null}
                    {!collapsed && badgeValue !== null && badgeValue > 0 ? (
                      <View style={styles.navBadge}>
                        <Text style={styles.navBadgeText}>{badgeValue}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {flyoutOpen && !collapsed ? (
        <View style={styles.flyout}>
          {renderFlyoutRow("create-outline", "Edit profile", () => navigateTo("/settings/profile" as Href))}
          {renderFlyoutRow("lock-closed-outline", "Change password", handleChangePassword)}
          <View style={styles.flyoutDivider} />
          {renderFlyoutRow("log-out-outline", "Sign out", handleSignOut)}
          {renderFlyoutRow("log-out-outline", "Sign out everywhere", handleSignOutEverywhere, true)}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          collapsed ? navigateTo("/settings/profile" as Href) : setFlyoutOpen((open) => !open)
        }
        style={[styles.profileRow, collapsed && styles.profileRowCollapsed, flyoutOpen && styles.profileRowActive]}
      >
        <Avatar name={userFullName || currentUser?.email} size={32} />
        {!collapsed ? (
          <>
            <View style={styles.profileInfo}>
              <Text numberOfLines={1} style={styles.profileName}>{userFullName || "Your account"}</Text>
              <Text numberOfLines={1} style={styles.profileEmail}>{currentUser?.email ?? ""}</Text>
            </View>
            <Ionicons name={flyoutOpen ? "chevron-down" : "ellipsis-horizontal"} size={16} color={colors.textMuted} />
          </>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brandRowCollapsed: {
    justifyContent: "center",
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  iconButton: {
    padding: 3,
    borderRadius: radius.sm,
  },
  orgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  orgRowCollapsed: {
    justifyContent: "center",
  },
  orgInfo: {
    flex: 1,
    overflow: "hidden",
  },
  orgName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  orgRole: {
    fontSize: 10,
    color: colors.textMuted,
  },
  navScroll: {
    flex: 1,
  },
  navContent: {
    paddingVertical: 6,
  },
  navGroup: {
    marginBottom: 2,
  },
  groupLabel: {
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 2,
  },
  groupGap: {
    height: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  navItemCollapsed: {
    justifyContent: "center",
    gap: 0,
  },
  navItemActive: {
    backgroundColor: colors.avatarBg,
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  navBadge: {
    minWidth: 20,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  flyout: {
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  flyoutItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  flyoutText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  flyoutTextDanger: {
    color: colors.danger,
  },
  flyoutDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  profileRowCollapsed: {
    justifyContent: "center",
  },
  profileRowActive: {
    backgroundColor: colors.surfaceMuted,
  },
  profileInfo: {
    flex: 1,
    overflow: "hidden",
  },
  profileName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
