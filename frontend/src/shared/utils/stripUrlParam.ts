import { Platform } from "react-native";

export function stripUrlParam(paramName: string): void
{
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has(paramName)) {
    return;
  }

  url.searchParams.delete(paramName);

  const queryString = url.searchParams.toString();
  const currentPathWithoutParam = `${url.pathname}${queryString ? `?${queryString}` : ""}${url.hash}`;
  window.history.replaceState({}, "", currentPathWithoutParam);
}
