import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export type AndroidPushResult =
  { status: "registered" } | { status: "unsupported" } | { status: "denied" };

export async function enableAndroidPushNotifications(): Promise<AndroidPushResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return { status: "unsupported" };
  }

  const current = await PushNotifications.checkPermissions();
  const permissions =
    current.receive === "granted" ? current : await PushNotifications.requestPermissions();

  if (permissions.receive !== "granted") {
    return { status: "denied" };
  }

  await PushNotifications.register();
  return { status: "registered" };
}
