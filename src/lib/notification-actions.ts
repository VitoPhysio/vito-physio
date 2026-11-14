export const ACTION_TOKEN_PREFIX = "vito-actions-v1:";

export function supportsAndroidActions(platform: string, build: string): boolean {
  return platform === "android" && /^\d+$/.test(build) && Number(build) >= 9;
}

export function notificationActionSearch(search: Record<string, unknown>): { conversation?: string; alertAction?: "reply" | "read" } {
  const conversation = typeof search["conversation"] === "string" ? search["conversation"] : undefined;
  const action = search["alertAction"];
  return conversation ? { conversation, ...(action === "reply" || action === "read" ? { alertAction: action } : {}) } : {};
}

export function notificationActionPath(path: string, action: unknown): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/notifications";
  if (action !== "reply" && action !== "read") return path;
  if (!path.startsWith("/messages?conversation=")) return path;
  return `${path}&alertAction=${action}`;
}