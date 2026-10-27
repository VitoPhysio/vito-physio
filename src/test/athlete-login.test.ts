import { describe, expect, it } from "vitest";
import { athleteLoginEmail, isAthleteCode } from "@/lib/athlete-login";

describe("athlete ID sign-in", () => {
  it("accepts generated athlete IDs", () => expect(isAthleteCode("vito-ath-00000012")).toBe(true));
  it("rejects account and organisation IDs", () => {
    expect(isAthleteCode("VITO-ACC-1A2B3C4D5E6F")).toBe(false);
    expect(isAthleteCode("VITO-SCH-00000001")).toBe(false);
  });
  it("maps an athlete ID to one stable login address", () =>
    expect(athleteLoginEmail(" VITO-ATH-00000012 ")).toBe("vito-ath-00000012@athletes.vitophysio.app"));
});
