import { describe, expect, it } from "vitest";
import { isAttachmentOnly } from "@/lib/chat-media";

describe("unframed chat attachments", () => {
  it("recognizes a photo without a caption", () => {
    expect(isAttachmentOnly({ body: "Shared an attachment", attachment_path: "chat/photo.jpg", deleted_at: null })).toBe(true);
    expect(isAttachmentOnly({ body: "", attachment_path: "chat/photo.jpg", deleted_at: null })).toBe(true);
  });
  it("keeps a caption with its photo", () => {
    expect(isAttachmentOnly({ body: "My photo", attachment_path: "chat/photo.jpg", deleted_at: null })).toBe(false);
  });
  it("does not treat deleted messages as photos", () => {
    expect(isAttachmentOnly({ body: "Shared an attachment", attachment_path: "chat/photo.jpg", deleted_at: "2026-11-13" })).toBe(false);
  });
});