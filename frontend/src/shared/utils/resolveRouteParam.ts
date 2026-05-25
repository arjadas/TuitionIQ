export function resolveRouteParam(input: string | string[] | undefined): string | null {
  if (!input) {
    return null;
  }

  if (Array.isArray(input)) {
    return input[0] ?? null;
  }

  return input;
}
