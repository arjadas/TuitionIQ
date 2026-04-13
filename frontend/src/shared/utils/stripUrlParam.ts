import { Platform } from "react-native";

export function stripUrlParam(paramName: string): void {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }

  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has(paramName)) {
    return;
  }

  currentUrl.searchParams.delete(paramName);
  const query = currentUrl.searchParams.toString();
  const sanitizedUrl = `${currentUrl.pathname}${query ? `?${query}` : ""}${currentUrl.hash}`;
  window.history.replaceState({}, "", sanitizedUrl);
}
