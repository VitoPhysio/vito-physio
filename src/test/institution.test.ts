import { describe, expect, it } from "vitest";
import {
  canEnterInstitutionWorkspace,
  institutionPermissions,
  normalizeSection,
  parseSports,
  orderByLastOpened,
  pickInitialInstitution,
} from "@/lib/institution";

describe("Institution workspace rules", () => {
  it("lets administrators and coaches enter the institution workspace", () => {
    expect(canEnterInstitutionWorkspace(["school_admin"])).toBe(true);
    expect(canEnterInstitutionWorkspace(["coach"])).toBe(true);
  });

  it("keeps athletes and parents out of the institution workspace", () => {
    expect(canEnterInstitutionWorkspace(["athlete"])).toBe(false);
    expect(canEnterInstitutionWorkspace(["parent"])).toBe(false);
  });

  it("gives only institution administrators management permissions", () => {
    expect(institutionPermissions("school_admin").reviewRequests).toBe(true);
    expect(institutionPermissions("coach").reviewRequests).toBe(false);
    expect(institutionPermissions("coach").editProfile).toBe(false);
    expect(institutionPermissions("coach").viewOverview).toBe(true);
    expect(institutionPermissions(null).viewOverview).toBe(false);
  });

  it("opens a single institution directly but lets multi-institution users choose", () => {
    expect(pickInitialInstitution(["a"])).toBe("a");
    expect(pickInitialInstitution(["a", "b"])).toBeNull();
    expect(pickInitialInstitution([])).toBeNull();
  });

  it("lists the last-opened institution first", () => {
    expect(orderByLastOpened([{ id: "a" }, { id: "b" }], "b").map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("removes duplicate and empty sports", () => {
    expect(parseSports("Football, football ,  Netball,,")).toEqual(["Football", "Netball"]);
  });

  it("falls back to the overview for unknown sections", () => {
    expect(normalizeSection("settings")).toBe("settings");
    expect(normalizeSection("hack")).toBe("overview");
  });
});
