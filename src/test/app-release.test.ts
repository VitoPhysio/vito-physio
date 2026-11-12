import { describe, expect, it } from "vitest";

import {
  APK_SOURCE_URL,
  CURRENT_APP_VERSION,
  compareVersions,
  detectWebPlatform,
} from "@/lib/app-release";

describe("app release version comparison", () => {
  it("offers version 1.6.0 to phones running version 1.5.0", () => {
    expect(CURRENT_APP_VERSION).toBe("1.6.0");
    expect(compareVersions(CURRENT_APP_VERSION, "1.5.0")).toBeGreaterThan(0);
  });

  it("downloads the signed APK from the latest GitHub release", () => {
    expect(APK_SOURCE_URL).toBe(
      "https://github.com/VitoPhysio/vito-physio/releases/latest/download/VitoPhysio.apk",
    );
  });
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

  it("detects Android browsers for the APK action", () => {
    expect(detectWebPlatform("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l")).toBe("android");
  });

  it("detects iPhone and iPad browsers for Home Screen guidance", () => {
    expect(
      detectWebPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone"),
    ).toBe("ios");
    expect(detectWebPlatform("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "iPad")).toBe("ios");
  });

  it("detects iPadOS desktop-mode Safari using touch points", () => {
    expect(detectWebPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 5)).toBe(
      "ios",
    );
  });

  it("uses the desktop experience for non-mobile browsers", () => {
    expect(detectWebPlatform("Mozilla/5.0 (X11; Linux x86_64)", "Linux x86_64")).toBe("desktop");
  });
});
