import { describe, expect, it } from "vitest";
import { isWorkspacePath } from "@/lib/workspace-navigation";

describe("Workspace navigation", () => {
  it.each(["/dashboard", "/cases", "/admin", "/dashboard/", "/cases/123", "/admin/accounts"])(
    "excludes persistent community navigation from %s",
    (path) => expect(isWorkspacePath(path)).toBe(true),
  );

  it.each(["/", "/messages", "/profile", "/link-account", "/notifications", "/cases-community"])(
    "keeps community navigation available on %s",
    (path) => expect(isWorkspacePath(path)).toBe(false),
  );
});