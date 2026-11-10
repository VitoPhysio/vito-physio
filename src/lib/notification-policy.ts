export function pushBody(category: string, body: string): string {
  return category === "messages" ? "Open VITO Physio to view this private message." : body;
}

export function deliveryOutcome(status: number, providerCode?: string) {
  if (providerCode === "UNREGISTERED") return "disable" as const;
  if (status === 429 || status >= 500) return "retry" as const;
  return "failed" as const;
}

export function notificationPath(path: string | null): string {
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/notifications";
}