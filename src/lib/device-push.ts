import { Capacitor } from "@capacitor/core";
import { enablePush } from "@/lib/push";
import { notificationActionPath, supportsAndroidActions } from "@/lib/notification-actions";

export type DevicePlatform = "web" | "android" | "ios";
export type DevicePushResult =
  | { status: "registered"; token: string; platform: DevicePlatform; androidActions?: boolean }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

const TOKEN_KEY = "vito-device-push-token";

export async function androidNotificationActions(): Promise<boolean> {
  if (currentPlatform() !== "android") return false;
  try {
    const { App } = await import("@capacitor/app");
    return supportsAndroidActions("android", (await App.getInfo()).build);
  } catch { return false; }
}

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
    return { ...result, platform, androidActions: await androidNotificationActions() };
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

  await ensureChannel();

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
    void PushNotifications.register();
  });
}

export async function disableDevicePush() {
  if (currentPlatform() !== "web") {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister().catch(() => undefined);
  }
}

async function ensureChannel() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.createChannel({
    id: "vito-default",
    name: "Messages & activity",
    description: "New messages, care updates and activity from VITO Physio",
    importance: 5,
    visibility: 1,
    sound: "default",
    vibration: true,
    lights: true,
  }).catch(() => undefined);
}

let nativeStarted = false;

/**
 * Runs once at app start on Android/iOS: makes sure the alert channel exists, opens the exact
 * screen when an alert in the notification shade is tapped (also on cold start), and refreshes
 * the device token when permission was already granted.
 */
export async function startNativePush(
  open: (path: string) => void,
  onToken: (token: string, platform: DevicePlatform, androidActions: boolean) => Promise<unknown>,
) {
  if (nativeStarted || currentPlatform() === "web") return;
  nativeStarted = true;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await ensureChannel();
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const path = action.notification.data?.path;
    if (typeof path === "string") open(notificationActionPath(path, action.notification.data?.vito_action));
  });
  await PushNotifications.addListener("registration", (t) => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: t.value, platform: currentPlatform() }));
    void androidNotificationActions().then((capable) => onToken(t.value, currentPlatform(), capable)).catch(() => undefined);
  });
  const perm = await PushNotifications.checkPermissions();
  if (perm.receive === "granted" && storedDeviceToken()) await PushNotifications.register();
}
