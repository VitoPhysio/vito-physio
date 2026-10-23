import { describe, expect, it } from "vitest";
import { memberProfileInput, profileKind } from "@/lib/member-profile";

describe("role-specific profile selection", () => {
  it("keeps athletes on the existing athlete editor", () => expect(profileKind(["athlete"])).toBe("athlete"));
  it.each([ ["coach", "coach"], ["parent", "parent"], ["school_admin", "organisation"], ["clinical_professional", "clinical"], ["clinical_supervisor", "clinical"], ["super_admin", "staff"], ["vito_admin", "staff"] ])("selects %s information", (role, kind) => expect(profileKind([role])).toBe(kind));
  it("does not choose the athlete editor for a professional with an athlete role", () => expect(profileKind(["athlete", "clinical_professional"])).toBe("clinical"));
  it("accepts non-athlete information without athlete names or a birth date", () => {
    const input = { full_name: "Coach Name", headline: "", position: "Coach", sport: "Football", school_name: "", team: "", district: "", country: "", bio: "", skills: [], interests: [], discoverable: true, visibility: "community" };
    expect(memberProfileInput.safeParse(input).success).toBe(true);
    expect(memberProfileInput.safeParse({ ...input, user_id: "another-user" }).success).toBe(false);
    expect(memberProfileInput.safeParse({ ...input, role: "super_admin" }).success).toBe(false);
  });
});
