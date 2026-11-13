export function isAttachmentOnly(message: { body: string; attachment_path: string | null; deleted_at: string | null }) {
  return !message.deleted_at && Boolean(message.attachment_path) && (!message.body.trim() || message.body === "Shared an attachment");
}

export function downloadChatFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}