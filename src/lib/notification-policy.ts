import { ACTION_TOKEN_PREFIX } from "./notification-actions";

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

/** Deep link that opens one conversation in the Messages system. */
export function conversationPath(conversationId: string): string {
  return `/messages?conversation=${encodeURIComponent(conversationId)}`;
}

const PREVIEW_LIMIT = 120;

/**
 * Device-push text for a chat message. Chat never goes through the notification bell;
 * the preview honours the recipient's `message_preview_enabled` privacy setting.
 */
export function messagePushContent(input: {
  senderName: string | null;
  body: string | null;
  attachmentName: string | null;
  isGroup: boolean;
  showPreview: boolean;
}): { title: string; body: string } {
  const sender = input.senderName?.trim() || "Someone";
  const title = input.isGroup ? `${sender} · group chat` : sender;
  if (!input.showPreview) return { title, body: "Sent you a new message." };
  const text = input.body?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return { title, body: input.attachmentName ? "📎 Sent an attachment" : "Sent you a new message." };
  return { title, body: text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT - 1)}…` : text };
}

/**
 * FCM v1 message. Web gets data-only (our service worker renders it and suppresses it when
 * VITO is focused); native Android/iOS get a system notification payload so it shows when closed.
 */
export function buildFcmMessage(input: {
  token: string;
  platform: string;
  title: string;
  body: string;
  path: string;
  tag: string;
}) {
  const data = { title: input.title, body: input.body, path: input.path, tag: input.tag };
  if (input.platform === "web") {
    return { token: input.token, data, webpush: { headers: { Urgency: "high" } } };
  }
  if (input.platform === "android" && input.token.startsWith(ACTION_TOKEN_PREFIX)) {
    return { token: input.token.slice(ACTION_TOKEN_PREFIX.length), data: { ...data, vito_actions: "1" }, android: { priority: "high" } };
  }
  return {
    token: input.token,
    data,
    notification: { title: input.title, body: input.body },
    android: { priority: "high", notification: { tag: input.tag, channel_id: "vito-default", default_sound: true, notification_priority: "PRIORITY_HIGH", visibility: "PUBLIC" } },
    apns: { headers: { "apns-collapse-id": input.tag.slice(0, 64) }, payload: { aps: { sound: "default" } } },
  };
}
