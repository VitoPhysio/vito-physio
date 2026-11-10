import { describe, expect, it } from "vitest";
import { deliveryOutcome, notificationPath, pushBody } from "@/lib/notification-policy";

describe("notification privacy and delivery", () => {
  it("never exposes private message text in phone previews", () => {
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