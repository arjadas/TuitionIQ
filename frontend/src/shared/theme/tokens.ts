/**
 * Design tokens derived from docs/tuitioniq_redesign_mockup.html.
 * New screens/components consume these; existing screens are not mass-refactored.
 */

export const colors = {
  primary: "#1D4ED8",
  primaryDark: "#1E40AF",
  action: "#0D9488",
  danger: "#DC2626",
  warning: "#D97706",

  background: "#F1F5F9",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",

  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  textLabel: "#334155",

  border: "#E2E8F0",
  borderMuted: "#DBE5EF",

  // Avatar / brand-tint surfaces (mockup .avatar)
  avatarBg: "#DBEAFE",
  avatarFg: "#1D4ED8",

  // Status tints
  successBg: "#CCFBF1",
  successFg: "#0F6E56",
  dangerBg: "#FEE2E2",
  dangerFg: "#991B1B",
  warningBg: "#FFF7ED",
  warningFg: "#9A3412",
  neutralBg: "#F1F5F9",
  neutralFg: "#475569",

  white: "#FFFFFF",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 999,
} as const;

export const typography = {
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: "700" },
  heading: { fontSize: 22, fontWeight: "700" },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 14, fontWeight: "400" },
  bodyStrong: { fontSize: 15, fontWeight: "700" },
  caption: { fontSize: 13, fontWeight: "400" },
  small: { fontSize: 12, fontWeight: "500" },
} as const;

/**
 * Map an organisation-member role to its badge palette.
 * Roles per database_schema.md: owner | admin | teacher | student.
 */
export function roleBadgePalette(role: string): { bg: string; fg: string } {
  switch (role.toLowerCase()) {
    case "owner":
      return { bg: colors.avatarBg, fg: colors.primary };
    case "admin":
      return { bg: "#EDE9FE", fg: "#5B21B6" };
    case "teacher":
      return { bg: colors.successBg, fg: colors.successFg };
    default:
      return { bg: colors.neutralBg, fg: colors.neutralFg };
  }
}
