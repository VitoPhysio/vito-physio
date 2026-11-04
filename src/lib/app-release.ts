export const APP_NAME = "Vito Physio";
export const CURRENT_APP_VERSION = "1.4";
export const APK_DOWNLOAD_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663441912362/TIKvJunOHigcegKD.apk";
export const APP_VERSION_MANIFEST_URL = "/app-version.json";

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
