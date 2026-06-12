import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { AppDrawer } from "@/src/shared/components/nav/AppDrawer";
import { colors, radius } from "@/src/shared/theme/tokens";
import { useUiStore } from "@/src/store/uiStore";

const WIDE_BREAKPOINT = 900;
const SIDEBAR_WIDTH = 218;
const SIDEBAR_WIDTH_COLLAPSED = 60;
const OVERLAY_WIDTH = 280;

// Pragmatic status-bar inset for the mobile top bar (no SafeAreaProvider is mounted at the root,
// so react-native-safe-area-context is intentionally avoided). On web this is a harmless 8px.
const topInset = Platform.select({ ios: 44, android: StatusBar.currentHeight ?? 24, default: 8 }) ?? 8;

export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const drawerOpen = useUiStore((state) => state.drawerOpen);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const openDrawer = useUiStore((state) => state.openDrawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);

  if (isWide) {
    return (
      <View style={styles.wideRoot}>
        <View style={[styles.sidebar, { width: sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH }]}>
          <AppDrawer variant="sidebar" />
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.narrowRoot}>
      <View style={[styles.topbar, { paddingTop: topInset + 8 }]}>
        <Pressable
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          hitSlop={8}
          onPress={openDrawer}
          style={styles.hamburger}
        >
          <Ionicons name="menu" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.topbarBrand}>
          <View style={styles.topbarMark}>
            <Ionicons name="book" size={13} color={colors.white} />
          </View>
          <Text style={styles.topbarText}>TuitionIQ</Text>
        </View>
        <View style={styles.topbarSpacer} />
      </View>

      <View style={styles.content}>{children}</View>

      {drawerOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityLabel="Close menu"
            accessibilityRole="button"
            onPress={closeDrawer}
            style={styles.backdrop}
          />
          <View style={[styles.overlayPanel, { width: OVERLAY_WIDTH }]}>
            <AppDrawer variant="overlay" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wideRoot: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.background,
  },
  sidebar: {
    height: "100%",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  narrowRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hamburger: {
    padding: 4,
  },
  topbarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  topbarMark: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  topbarText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  topbarSpacer: {
    width: 32,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  overlayPanel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    elevation: 8,
  },
});
