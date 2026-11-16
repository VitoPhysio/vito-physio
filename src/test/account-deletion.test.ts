import { describe, expect, it } from "vitest";
import { accountDeletionBlock, athleteRecordDeletionBlock } from "@/lib/account-deletion";

describe("admin account deletion", () => {
  it("lets the super admin delete any athlete or ordinary account", () => {
    expect(accountDeletionBlock("super", "me", "u1", ["athlete"])).toBeNull();
    expect(accountDeletionBlock("super", "me", "u2", ["coach"])).toBeNull();
  });
  it("lets the super admin delete VITO admins but not ordinary VITO admins", () => {
    expect(accountDeletionBlock("super", "me", "u3", ["vito_admin"])).toBeNull();
    expect(accountDeletionBlock("vito", "me", "u3", ["vito_admin"])).toMatch(/Only the super admin/);
  });
  it("never deletes the super admin or the signed-in account", () => {
    expect(accountDeletionBlock("super", "me", "u4", ["super_admin"])).toMatch(/cannot be removed/);
    expect(accountDeletionBlock("super", "me", "me", ["athlete"])).toMatch(/your own account/);
  });
  it("allows only the super admin to delete athlete records", () => {
    expect(athleteRecordDeletionBlock("super")).toBeNull();
    expect(athleteRecordDeletionBlock("vito")).toMatch(/Only the super admin/);
  });
});
