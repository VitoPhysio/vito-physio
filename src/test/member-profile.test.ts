import { describe, expect, it } from "vitest";
import {
  memberProfileCopy,
  memberProfileInput,
  profileDisplayName,
  profileKind,
} from "@/lib/member-profile";

describe("role-specific profile selection", () => {
  it("keeps athletes on the existing athlete editor", () =>
    expect(profileKind(["athlete"])).toBe("athlete"));
  it.each([
    ["coach", "coach"],
    ["parent", "parent"],
    ["school_admin", "organisation"],
    ["clinical_professional", "clinical"],
    ["clinical_supervisor", "clinical"],
    ["super_admin", "staff"],
    ["vito_admin", "staff"],
  ])("selects %s information", (role, kind) => expect(profileKind([role])).toBe(kind));
  it("does not choose the athlete editor for a professional with an athlete role", () =>
    expect(profileKind(["athlete", "clinical_professional"])).toBe("clinical"));
  it("prioritizes institutional profile guidance for accounts with multiple roles", () => {
    expect(profileKind(["clinical_professional", "school_admin"])).toBe("organisation");
    expect(profileKind(["school_admin", "vito_admin", "coach"])).toBe("staff");
  });
  it("accepts non-athlete information without athlete names or a birth date", () => {
    const input = {
      full_name: "Coach Name",
      headline: "",
      position: "Coach",
      sport: "Football",
      school_name: "",
      team: "",
      district: "",
      country: "",
      bio: "",
      skills: [],
      interests: [],
      discoverable: true,
      visibility: "community",
    };
    expect(memberProfileInput.safeParse(input).success).toBe(true);
    expect(memberProfileInput.safeParse({ ...input, user_id: "another-user" }).success).toBe(false);
    expect(memberProfileInput.safeParse({ ...input, role: "super_admin" }).success).toBe(false);
  });
});

describe("role-aware profile presentation", () => {
  it("uses the institution name rather than an institutional admin's personal name", () => {
    expect(profileDisplayName("school_admin", "Admin Person", "Northside Academy")).toBe(
      "Northside Academy",
    );
    expect(profileDisplayName("school_admin", "Admin Person", " ")).toBe("Institution profile");
  });
  it.each(["super_admin", "vito_admin"])("uses the VITO Physio identity for %s", (role) => {
    expect(profileDisplayName(role, "Administrator Name")).toBe("VITO Physio");
  });
  it("keeps personal names for coaches, clinicians, athletes, and parents", () => {
    for (const role of ["coach", "clinical_professional", "athlete", "parent"]) {
      expect(profileDisplayName(role, "  Taylor Member  ")).toBe("Taylor Member");
    }
  });
  it("provides institutional copy that explicitly describes the institution", () => {
    expect(memberProfileCopy("organisation").aboutHint).toMatch(/institution’s mission/i);
    expect(memberProfileCopy("staff").aboutHint).toMatch(/not an individual administrator/i);
  });
  it("gives coaches guidance about their associated teams and institutions", () => {
    expect(memberProfileCopy("coach").aboutHint).toMatch(/teams or institutions/i);
  });
  it("warns clinical professionals and parents not to publish sensitive details", () => {
    expect(memberProfileCopy("clinical").aboutHint).toMatch(/patient or case information/i);
    expect(memberProfileCopy("parent").aboutHint).toMatch(/sensitive details/i);
  });
});
