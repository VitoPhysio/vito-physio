import { describe, expect, it } from "vitest";
import { getMessageAttachmentMetadata } from "@/lib/message-attachments";

describe("message attachment metadata", () => {
  it("sends all attachment fields as null for a text-only message", () => {
    expect(getMessageAttachmentMetadata(null, null)).toEqual({
      attachment_path: null,
      attachment_name: null,
      attachment_content_type: null,
      attachment_size: null,
    });
  });

  it("preserves file metadata and falls back to an octet-stream content type", () => {
    expect(
      getMessageAttachmentMetadata(
        { name: "notes.bin", type: "", size: 12 },
        "conversation/user/notes.bin",
      ),
    ).toEqual({
      attachment_path: "conversation/user/notes.bin",
      attachment_name: "notes.bin",
      attachment_content_type: "application/octet-stream",
      attachment_size: 12,
    });
  });

  it("preserves the browser-provided content type for attachments", () => {
    expect(
      getMessageAttachmentMetadata(
        { name: "scan.png", type: "image/png", size: 256 },
        "conversation/user/scan.png",
      ),
    ).toEqual({
      attachment_path: "conversation/user/scan.png",
      attachment_name: "scan.png",
      attachment_content_type: "image/png",
      attachment_size: 256,
    });
  });
});
