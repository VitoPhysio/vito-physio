/** Institution-scoped roles and permissions for the institutional workspace. */
export type InstitutionRole = "school_admin" | "coach";

export const INSTITUTION_ROLE_LABEL: Record<InstitutionRole, string> = {
  school_admin: "Institution administrator",
  coach: "Coach",
};

export const INSTITUTION_TYPE_LABEL: Record<string, string> = {
  school: "School",
  club: "Club",
  academy: "Academy",
};

/** Global account roles that may enter the institutional workspace. */
export const WORKSPACE_ACCOUNT_ROLES = ["school_admin", "coach"] as const;

export function canEnterInstitutionWorkspace(roles: string[]): boolean {
  return roles.some((role) => (WORKSPACE_ACCOUNT_ROLES as readonly string[]).includes(role));
}

/** UI hints only. The database enforces the same rules in its functions and policies. */
export function institutionPermissions(role: string | null | undefined) {
  const admin = role === "school_admin";
  const member = admin || role === "coach";
  return {
    viewOverview: member,
    editProfile: admin,
    reviewRequests: admin,
    manageMembers: admin,
    viewMemberEmails: admin,
    manageAthletes: admin,
    manageTeams: admin,
    messageEveryone: admin,
    messageTeams: member,
    reportInjury: member,
    referAthletes: member,
    recordConsent: admin,
    reviewPatterns: admin,
    viewAudit: admin,
    viewReports: member,
  };
}

export const LAST_INSTITUTION_KEY = "vito.workspace.institution";

/** Open the institution directly only when it is the user's single membership; otherwise show the chooser. */
export function pickInitialInstitution(ids: string[]): string | null {
  return ids.length === 1 ? (ids[0] ?? null) : null;
}

/** Put the last-opened institution first so it is easy to return to. */
export function orderByLastOpened<T extends { id: string }>(items: T[], lastOpened: string | null): T[] {
  return [...items].sort((a, b) => Number(b.id === lastOpened) - Number(a.id === lastOpened));
}

export function parseSports(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const sport = part.trim().replace(/\s+/g, " ").slice(0, 60);
    const key = sport.toLowerCase();
    if (sport && !seen.has(key)) {
      seen.add(key);
      out.push(sport);
    }
  }
  return out;
}

export const WORKSPACE_SECTIONS = [
  "overview",
  "athletes",
  "teams",
  "injuries",
  "surveillance",
  "rehabilitation",
  "communications",
  "professionals",
  "reports",
  "settings",
] as const;
export type WorkspaceSection = (typeof WORKSPACE_SECTIONS)[number];

export function normalizeSection(value: unknown): WorkspaceSection {
  return (WORKSPACE_SECTIONS as readonly string[]).includes(value as string)
    ? (value as WorkspaceSection)
    : "overview";
}

export const SHARING_SCOPES = [
  { value: "participation", label: "Sports participation", detail: "Name, ID, age, sport, level and teams" },
  { value: "injury_summary", label: "Injury and recovery summary", detail: "Injuries, severity, status, time lost and rehabilitation phase" },
  { value: "clinical", label: "Confidential clinical records", detail: "Assessments and clinical notes written by VITO clinicians" },
] as const;

export const PROFESSIONAL_SPECIALTIES = [
  "Sports physician",
  "Physiotherapist",
  "Orthopaedic specialist",
  "General medical practitioner",
  "Sports healthcare professional",
] as const;

export const REFERRAL_STATUS_LABEL: Record<string, string> = {
  pending_consent: "Waiting for consent",
  sent: "Sent to professional",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
  open: "Open",
};

export const MESSAGE_KIND_LABEL: Record<string, string> = {
  message: "Message",
  announcement: "Announcement",
  reminder: "Reminder",
  appointment: "Appointment information",
  follow_up: "Injury follow-up",
};
