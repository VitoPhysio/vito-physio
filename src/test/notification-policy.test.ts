import { describe, expect, it } from "vitest";
import {
  buildFcmMessage,
  conversationPath,
  deliveryOutcome,
  messagePushContent,
  notificationPath,
  pushBody,
} from "@/lib/notification-policy";

describe("notification privacy and delivery", () => {
  it("never exposes private message text in legacy bell pushes", () => {
    expect(pushBody("messages", "Private patient discussion")).toBe("Open VITO Physio to view this private message.");
  });
  it("backs off for temporary failures", () => {
    expect(deliveryOutcome(429)).toBe("retry");
    expect(deliveryOutcome(503)).toBe("retry");
    expect(deliveryOutcome(403)).toBe("failed");
  });
  it("disables expired registration tokens", () => {
    expect(deliveryOutcome(404, "UNREGISTERED")).toBe("disable");
  });
  it("keeps phone destinations inside VITO", () => {
    expect(notificationPath("//evil.example")).toBe("/notifications");
    expect(notificationPath("/messages?conversation=123")).toBe("/messages?conversation=123");
  });
});

describe("chat message pushes", () => {
  it("opens the exact conversation", () => {
    expect(conversationPath("abc-123")).toBe("/messages?conversation=abc-123");
  });
  it("shows sender name and preview when allowed", () => {
    expect(
      messagePushContent({ senderName: "Amina", body: "See you at training", attachmentName: null, isGroup: false, showPreview: true }),
    ).toEqual({ title: "Amina", body: "See you at training" });
  });
  it("hides message text when the recipient turned previews off", () => {
    expect(
      messagePushContent({ senderName: "Amina", body: "Private", attachmentName: null, isGroup: false, showPreview: false }).body,
    ).toBe("Sent you a new message.");
  });
  it("labels group chats and attachments", () => {
    expect(
      messagePushContent({ senderName: "Coach", body: "", attachmentName: "plan.pdf", isGroup: true, showPreview: true }),
    ).toEqual({ title: "Coach · group chat", body: "📎 Sent an attachment" });
  });
  it("sends web pushes data-only so the app can suppress duplicates while open", () => {
    const web = buildFcmMessage({ token: "t", platform: "web", title: "a", body: "b", path: "/messages", tag: "c" });
    expect("notification" in web).toBe(false);
    const android = buildFcmMessage({ token: "t", platform: "android", title: "a", body: "b", path: "/messages", tag: "c" });
    expect("notification" in android).toBe(true);
  });
  it("posts Android alerts to the high-importance channel and lets taps open the app", () => {
    const android = buildFcmMessage({ token: "t", platform: "android", title: "a", body: "b", path: "/messages?conversation=x", tag: "c" }) as {
      data: { path: string };
      android: { notification: Record<string, unknown> };
    };
    expect(android.android.notification["channel_id"]).toBe("vito-default");
    expect(android.android.notification["click_action"]).toBeUndefined();
    expect(android.data.path).toBe("/messages?conversation=x");
  });
});
