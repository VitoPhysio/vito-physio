import { Capacitor } from "@capacitor/core";
import { enablePush } from "@/lib/push";

export type DevicePlatform = "web" | "android" | "ios";
export type DevicePushResult =
  | { status: "registered"; token: string; platform: DevicePlatform }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

const TOKEN_KEY = "vito-device-push-token";

export function currentPlatform(): DevicePlatform {
  const p = Capacitor.getPlatform();
  return p === "android" || p === "ios" ? p : "web";
}

export function storedDeviceToken(): { token: string; platform: DevicePlatform } | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as { token: string; platform: DevicePlatform }) : null;
  } catch {
    return null;
  }
}

export function forgetDeviceToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Android/iOS app → native system notifications; installed web app and desktop → browser push. Call from a tap. */
export async function enableDevicePush(): Promise<DevicePushResult> {
  const platform = currentPlatform();
  const result = platform === "web" ? await enablePush() : await enableNativePush();
  if (result.status === "registered") {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: result.token, platform }));
    return { ...result, platform };
  }
  return result;
}

async function enableNativePush(): Promise<DevicePushResult> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return { status: "denied" };

  await PushNotifications.createChannel?.({
    id: "vito-default",
    name: "VITO Physio",
    importance: 5,
    visibility: 1,
  }).catch(() => undefined);

  return new Promise<DevicePushResult>((resolve) => {
    const timer = setTimeout(() => resolve({ status: "not-configured" }), 15000);
    void PushNotifications.addListener("registration", (t) => {
      clearTimeout(timer);
      resolve({ status: "registered", token: t.value, platform: currentPlatform() });
    });
    void PushNotifications.addListener("registrationError", () => {
      clearTimeout(timer);
      resolve({ status: "not-configured" });
    });
    void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const path = action.notification.data?.path;
      if (typeof path === "string" && path.startsWith("/")) window.location.assign(path);
    });
    void PushNotifications.register();
  });
}

export async function disableDevicePush() {
  if (currentPlatform() !== "web") {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister().catch(() => undefined);
  }
}
