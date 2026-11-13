export const ACTION_TOKEN_PREFIX = "vito-actions-v1:";

export function notificationActionPath(path: string, action: unknown): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/notifications";
  if (action !== "reply" && action !== "read") return path;
  if (!path.startsWith("/messages?conversation=")) return path;
  return `${path}&alertAction=${action}`;
}