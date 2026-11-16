/** Who may permanently delete accounts and athlete records from the VITO admin dashboard. */
export type AdminLevel = "super" | "vito";

export function accountDeletionBlock(
  level: AdminLevel,
  actorId: string,
  targetId: string,
  targetRoles: string[],
): string | null {
  if (actorId === targetId) return "You cannot remove your own account.";
  if (targetRoles.includes("super_admin")) return "The super admin cannot be removed.";
  if (targetRoles.includes("vito_admin") && level !== "super")
    return "Only the super admin can remove VITO admins.";
  return null;
}

export function athleteRecordDeletionBlock(level: AdminLevel): string | null {
  return level === "super" ? null : "Only the super admin can delete athlete records.";
}
