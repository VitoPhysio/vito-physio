/**
 * Google sign-in cannot carry signup metadata, so handle_new_user gives every
 * new Google user the default athlete role. After the redirect we claim the
 * role the person picked on the signup form. This planner is the tested part;
 * claimGoogleSignupRole applies it.
 */
export const GOOGLE_SIGNUP_ROLES = [
  "athlete",
  "parent",
  "coach",
  "school_admin",
  "vito_admin",
  "clinical_professional",
] as const;
export type GoogleSignupRole = (typeof GOOGLE_SIGNUP_ROLES)[number];

export function googleSignupRole(value: string): GoogleSignupRole | null {
  const role = value === "school_admin:club" ? "school_admin" : value;
  return GOOGLE_SIGNUP_ROLES.find((candidate) => candidate === role) ?? null;
}

/** Only the first Google sign-in may finish signup; never reclassify returning accounts. */
export function isFirstGoogleSignup(user: {
  created_at: string;
  last_sign_in_at?: string | undefined;
  app_metadata: { provider?: string | undefined; vito_google_signup_complete?: boolean | undefined };
}): boolean {
  if (user.app_metadata.provider !== "google" || user.app_metadata.vito_google_signup_complete) return false;
  const created = Date.parse(user.created_at);
  const signedIn = Date.parse(user.last_sign_in_at ?? "");
  return Number.isFinite(created) && Number.isFinite(signedIn) && signedIn >= created && signedIn - created < 30_000;
}

export type GoogleRoleClaim =
  | { kind: "none" }
  | { kind: "request-staff"; role: "vito_admin" | "clinical_professional" }
  | { kind: "replace-athlete"; role: "parent" | "coach" | "school_admin" };

export function planGoogleSignupRole(
  pendingRole: GoogleSignupRole,
  existingRoles: string[],
  isNewSignup = false,
): GoogleRoleClaim {
  if (!isNewSignup) return { kind: "none" };
  // Already holds a real role (returning user, or staff approved earlier): never touch it.
  if (existingRoles.some((r) => r !== "athlete")) return { kind: "none" };
  // Athlete is exactly what the trigger already created.
  if (pendingRole === "athlete") return { kind: "none" };
  // Staff roles stay approval-gated: record the request, keep the athlete default.
  if (pendingRole === "vito_admin" || pendingRole === "clinical_professional") {
    return { kind: "request-staff", role: pendingRole };
  }
  return { kind: "replace-athlete", role: pendingRole };
}
