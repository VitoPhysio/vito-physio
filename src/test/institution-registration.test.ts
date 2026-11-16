import { describe, expect, it } from "vitest";
import { institutionSignupMetadata } from "@/lib/institution-registration";

const input = { name: "Bukerere", type: "school" as const, emailAuthorized: true as const, phone: "", location: "", notes: "" };
describe("institution administrator registration", () => {
  it("uses the institution name and an administrator role", () => {
    expect(institutionSignupMetadata(input)).toMatchObject({ full_name: "Bukerere", org_name: "Bukerere", requested_role: "school_admin" });
  });
  it("joins an existing institution without creating one or replacing its logo", () => {
    const metadata = institutionSignupMetadata({ ...input, institutionId: "e4b27c39-c4fb-4a2d-a0ed-170c556a4473", photo: "personal-photo" });
    expect(metadata.join_school_id).toBe("e4b27c39-c4fb-4a2d-a0ed-170c556a4473");
    expect(metadata).not.toHaveProperty("org_name");
    expect(metadata).not.toHaveProperty("avatar_path");
    expect(metadata.requested_role).toBe("school_admin");
  });
  it("requires institutional authorization for the email", () => {
    expect(() => institutionSignupMetadata({ ...input, emailAuthorized: false as unknown as true })).toThrow();
  });
});