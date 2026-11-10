export type MessageAttachmentFile = Pick<File, "name" | "type" | "size">;

export function getMessageAttachmentMetadata(
  file: MessageAttachmentFile | null,
  path: string | null,
) {
  if (!file) {
    return {
      attachment_path: null,
      attachment_name: null,
      attachment_content_type: null,
      attachment_size: null,
    };
  }

  return {
    attachment_path: path,
    attachment_name: file.name,
    attachment_content_type: file.type || "application/octet-stream",
    attachment_size: file.size,
  };
}
