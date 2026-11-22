/** Athlete care requests: what athletes can ask for and who receives it. */
export const CARE_REQUEST_KIND: Record<string, string> = {
  appointment: "Appointment",
  consultation: "Consultation",
  follow_up: "Follow-up",
};

export type CareRequestTarget = "clinic" | "institution";

/** Requests without an institution go to the VITO clinical team. */
export function careRequestDestination(schoolName: string | null): string {
  return schoolName ? schoolName : "the VITO clinical team";
}

/**
 * Where an athlete message lands. Institution messages need the athlete's own institution;
 * everything else goes to the VITO clinical team.
 */
export function resolveCareTarget(target: CareRequestTarget, athleteSchoolId: string | null | undefined): { school_id: string | null; audience: "clinicians" | "institution" } {
  if (target === "institution") {
    if (!athleteSchoolId) throw new Error("This athlete is not registered with an institution yet.");
    return { school_id: athleteSchoolId, audience: "institution" };
  }
  return { school_id: null, audience: "clinicians" };
}
