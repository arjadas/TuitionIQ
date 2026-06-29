import { colors } from "@/src/shared/theme/tokens";

export type FeeStatusPalette = { bg: string; fg: string };

/**
 * Single source of truth for fee-period status colours. Derived from the
 * status tints in src/shared/theme/tokens.ts so every payment surface
 * (badges, timeline cells, list rows) stays visually consistent.
 */
export function feeStatusPalette(status: string): FeeStatusPalette {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return { bg: colors.successBg, fg: colors.successFg };
    case "partial":
      return { bg: colors.warningBg, fg: colors.warningFg };
    case "unpaid":
      return { bg: colors.dangerBg, fg: colors.dangerFg };
    case "overdue":
      return { bg: "#FEF3C7", fg: "#92400E" };
    case "waived":
      return { bg: "#EDE9FE", fg: "#5B21B6" };
    default:
      return { bg: colors.neutralBg, fg: colors.neutralFg };
  }
}

/** Period statuses that still carry an outstanding balance owed by the student. */
const OUTSTANDING_STATUSES = new Set(["unpaid", "partial", "overdue"]);

export function isOutstandingStatus(status: string): boolean {
  return OUTSTANDING_STATUSES.has(status.trim().toLowerCase());
}

export function isWaivedStatus(status: string): boolean {
  return status.trim().toLowerCase() === "waived";
}

/** Human label for a year/month period, e.g. "April 2026". */
export function periodMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Compact label for a year/month period, e.g. "Apr 2026". */
export function periodMonthShortLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}
