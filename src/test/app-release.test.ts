import { describe, expect, it } from "vitest";

import { compareVersions } from "@/lib/app-release";

describe("app release version comparison", () => {
  it("detects a newer release", () => {
    expect(compareVersions("1.3.0", "1.2.0")).toBeGreaterThan(0);
  });

  it("does not treat the same release as an update", () => {
    expect(compareVersions("1.3.0", "1.3.0")).toBe(0);
  });

  it("handles different version lengths", () => {
    expect(compareVersions("1.3", "1.3.0")).toBe(0);
    expect(compareVersions("2.0.0", "1.9")).toBeGreaterThan(0);
  });
});
