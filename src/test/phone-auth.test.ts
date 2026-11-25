import { describe, expect, it } from "vitest";
import {
  isPhoneSignInLookupError,
  normalizeAuthPhoneNumber,
  phoneAuthErrorMessage,
} from "@/lib/phone-auth";

describe("phone sign-in helpers", () => {
  it("normalizes punctuation in an international number", () => {
    expect(normalizeAuthPhoneNumber(" +256 (772) 123-456 ")).toBe("+256772123456");
  });

  it("requires an explicit country code and valid E.164 length", () => {
    expect(() => normalizeAuthPhoneNumber("0772123456")).toThrow(/country code/i);
    expect(() => normalizeAuthPhoneNumber("+256123")).toThrow(/country code/i);
    expect(() => normalizeAuthPhoneNumber("++256772123456")).toThrow(/country code/i);
  });

  it("classifies missing phone accounts for generic code-request handling", () => {
    expect(isPhoneSignInLookupError("User not found")).toBe(true);
    expect(isPhoneSignInLookupError("Signups not allowed for OTP")).toBe(true);
    expect(isPhoneSignInLookupError("SMS provider is not configured")).toBe(false);
  });

  it("explains when the Supabase phone provider is disabled", () => {
    expect(phoneAuthErrorMessage("Unsupported phone provider", false)).toMatch(
      /not active on the VITO authentication project/i,
    );
  });

  it("does not expose account existence in phone-auth failures", () => {
    const missingUser = phoneAuthErrorMessage("User not found", false);
    const signupBlocked = phoneAuthErrorMessage("Signups not allowed for OTP", false);
    expect(missingUser).toBe(signupBlocked);
    expect(missingUser).not.toMatch(/This number (?:is not|isn't) linked/i);
  });

  it("does not reveal whether a phone is already linked to a different account", () => {
    const message = phoneAuthErrorMessage("Phone number already registered", true);
    expect(message).not.toMatch(/already registered|belongs to|another account/i);
  });
});
