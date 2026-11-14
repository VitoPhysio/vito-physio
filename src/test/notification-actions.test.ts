import { describe, expect, it } from "vitest";
import { ACTION_TOKEN_PREFIX, notificationActionPath, notificationActionSearch, supportsAndroidActions } from "@/lib/notification-actions";
import { buildFcmMessage } from "@/lib/notification-policy";

describe("Android alert actions", () => {
  it("opens Reply in the original conversation", () => {
    expect(notificationActionPath("/messages?conversation=abc", "reply")).toBe("/messages?conversation=abc&alertAction=reply");
    expect(notificationActionSearch({ conversation: "abc", alertAction: "reply" })).toEqual({ conversation: "abc", alertAction: "reply" });
  });
  it("preserves Mark as read through message navigation", () => {
    expect(notificationActionPath("/messages?conversation=abc", "read")).toBe("/messages?conversation=abc&alertAction=read");
    expect(notificationActionSearch({ conversation: "abc", alertAction: "read" })).toEqual({ conversation: "abc", alertAction: "read" });
  });
  it("does not accept external destinations or unknown actions", () => {
    expect(notificationActionPath("//example.com", "reply")).toBe("/notifications");
    expect(notificationActionSearch({ conversation: "abc", alertAction: "delete" })).toEqual({ conversation: "abc" });
  });
  it("enables local Android alerts only on the finished native build", () => {
    expect(supportsAndroidActions("android", "9")).toBe(true);
    expect(supportsAndroidActions("android", "8")).toBe(false);
    expect(supportsAndroidActions("ios", "9")).toBe(false);
    expect(supportsAndroidActions("android", "unknown")).toBe(false);
  });
  it("strips the capability prefix before delivery and requests native actions", () => {
    const alert = buildFcmMessage({ token: `${ACTION_TOKEN_PREFIX}real-token`, platform: "android", title: "Coach", body: "Training", path: "/messages?conversation=abc", tag: "abc" });
    expect(alert.token).toBe("real-token");
    expect(alert.data).toMatchObject({ vito_actions: "1", path: "/messages?conversation=abc" });
    expect("notification" in alert).toBe(false);
  });
  it("keeps ordinary system notifications working for older APKs", () => {
    const alert = buildFcmMessage({ token: "old-token", platform: "android", title: "Coach", body: "Training", path: "/messages?conversation=abc", tag: "abc" });
    expect(alert.token).toBe("old-token");
    expect(alert).toHaveProperty("notification", { title: "Coach", body: "Training" });
  });
});