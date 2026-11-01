import { describe, expect, it } from "vitest";
import { googleSignupRole, isFirstGoogleSignup, planGoogleSignupRole } from "@/lib/google-signup";

describe("Google signup role claim", () => {
  it("does nothing for athletes, which the signup trigger already creates", () => {
    expect(planGoogleSignupRole("athlete", ["athlete"])).toEqual({ kind: "none" });
  });
  it("never changes an account that already holds a non-athlete role", () => {
    expect(planGoogleSignupRole("coach", ["coach"])).toEqual({ kind: "none" });
    expect(planGoogleSignupRole("athlete", ["clinical_professional"])).toEqual({ kind: "none" });
  });
  it("replaces the default athlete role for parent, coach and school admin", () => {
    expect(planGoogleSignupRole("parent", ["athlete"], true)).toEqual({ kind: "replace-athlete", role: "parent" });
    expect(planGoogleSignupRole("coach", ["athlete"], true)).toEqual({ kind: "replace-athlete", role: "coach" });
    expect(planGoogleSignupRole("school_admin", [], true)).toEqual({ kind: "replace-athlete", role: "school_admin" });
  });
  it("only records a request for approval-gated staff roles", () => {
    expect(planGoogleSignupRole("vito_admin", ["athlete"], true)).toEqual({ kind: "request-staff", role: "vito_admin" });
    expect(planGoogleSignupRole("clinical_professional", ["athlete"], true)).toEqual({ kind: "request-staff", role: "clinical_professional" });
  });
  it("preserves returning athletes even if another account type is selected", () => {
    expect(planGoogleSignupRole("coach", ["athlete"], false)).toEqual({ kind: "none" });
    expect(planGoogleSignupRole("parent", ["athlete"], false)).toEqual({ kind: "none" });
  });
  it("normalizes club admins and rejects unsupported roles", () => {
    expect(googleSignupRole("school_admin:club")).toBe("school_admin");
    expect(googleSignupRole("super_admin")).toBeNull();
  });
  it("requires an initial Google session and an unfinished signup", () => {
    const user = { created_at: "2026-11-01T08:00:00Z", last_sign_in_at: "2026-11-01T08:00:01Z", app_metadata: { provider: "google" } };
    expect(isFirstGoogleSignup(user)).toBe(true);
    expect(isFirstGoogleSignup({ ...user, last_sign_in_at: "2026-11-02T08:00:00Z" })).toBe(false);
    expect(isFirstGoogleSignup({ ...user, app_metadata: { provider: "email" } })).toBe(false);
    expect(isFirstGoogleSignup({ ...user, app_metadata: { provider: "google", vito_google_signup_complete: true } })).toBe(false);
    expect(isFirstGoogleSignup({ ...user, last_sign_in_at: undefined })).toBe(false);
  });
});
