function sanitizeIntegerAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.trunc(amount);
}

export function formatCurrency(amount: number, currency: string): string {
  const normalizedCurrency = (currency || "").trim().toUpperCase();
  const wholeAmount = sanitizeIntegerAmount(amount);

  if (normalizedCurrency === "BDT") {
    const formatted = new Intl.NumberFormat("en-BD", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(wholeAmount);

    return `৳${formatted}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(wholeAmount);
  } catch {
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(wholeAmount);

    return `${normalizedCurrency} ${formatted}`.trim();
  }
}
