export const APP_NAME = "Vito Physio";
export const CURRENT_APP_VERSION = "1.7.1";
export const APK_SOURCE_URL =
  "https://github.com/VitoPhysio/vito-physio/releases/latest/download/VitoPhysio.apk";
export const APK_DOWNLOAD_URL = "/api/download-app";
export const APP_VERSION_MANIFEST_URL = "/app-version.json";

export type WebPlatform = "android" | "ios" | "desktop";

export function detectWebPlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints = 0,
): WebPlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (platform === "MacIntel" && maxTouchPoints > 1) return "ios";
  return "desktop";
}

export function compareVersions(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}
