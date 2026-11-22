/** Clinical and institution threads must never appear in the social inbox. */
export function isWorkspaceThread(conversation: { kind: string }): boolean {
  return conversation.kind === "workspace";
}

export function workspaceSenderName(name: string | null | undefined, isAdmin: boolean): string {
  return name?.trim() || (isAdmin ? "VITO administration" : "Workspace member");
}