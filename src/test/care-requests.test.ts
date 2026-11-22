import { describe, expect, it } from "vitest";
import { careRequestDestination, resolveCareTarget } from "@/lib/care-requests";

describe("athlete care request routing", () => {
  it("sends clinic requests to the VITO clinical team", () => {
    expect(resolveCareTarget("clinic", "school-1")).toEqual({ school_id: null, audience: "clinicians" });
  });
  it("sends institution requests to the athlete's own institution", () => {
    expect(resolveCareTarget("institution", "school-1")).toEqual({ school_id: "school-1", audience: "institution" });
  });
  it("refuses institution requests when the athlete has no institution", () => {
    expect(() => resolveCareTarget("institution", null)).toThrow();
  });
  it("labels requests without an institution as the VITO clinical team", () => {
    expect(careRequestDestination(null)).toBe("the VITO clinical team");
  });
});
