import { describe, expect, it } from "vitest";
import { isWorkspaceThread, workspaceSenderName } from "@/lib/workspace-messaging";

describe("workspace message separation", () => {
  it("includes clinical and institution workspace conversations", () => {
    expect(isWorkspaceThread({ kind: "workspace" })).toBe(true);
  });
  it("keeps personal direct and group conversations social", () => {
    expect(isWorkspaceThread({ kind: "direct" })).toBe(false);
    expect(isWorkspaceThread({ kind: "group" })).toBe(false);
  });
  it("shows the actual sender name rather than labelling everyone a clinician", () => {
    expect(workspaceSenderName("Moses Okwaja", false)).toBe("Moses Okwaja");
    expect(workspaceSenderName("Institution administrator", true)).toBe("Institution administrator");
  });
  it("does not invent a clinical role when a name is unavailable", () => {
    expect(workspaceSenderName(null, false)).toBe("Workspace member");
    expect(workspaceSenderName("", true)).toBe("VITO administration");
  });
});