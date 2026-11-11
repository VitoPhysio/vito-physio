import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  disableDevicePush,
  enableDevicePush,
  forgetDeviceToken,
  storedDeviceToken,
} from "@/lib/device-push";
import { registerDeviceToken, unregisterDeviceToken } from "@/lib/notification.functions";

/** One switch: turn real phone/desktop pop-up notifications on or off for this device. */
export function PhoneNotificationsToggle({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const register = useServerFn(registerDeviceToken);
  const unregister = useServerFn(unregisterDeviceToken);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = storedDeviceToken();
    const blocked = typeof Notification !== "undefined" && Notification.permission === "denied";
    setEnabled(Boolean(saved) && !blocked);
  }, []);

  async function turnOn() {
    const result = await enableDevicePush();
    if (result.status === "registered") {
      await register({ data: { token: result.token, platform: result.platform } });
      setEnabled(true);
      void queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
      toast.success("Notifications are on. You'll get pop-ups on this device.");
      return;
    }
    const messages: Record<typeof result.status, string> = {
      "open-in-new-tab": "Open VITO Physio in its own tab or the installed app to allow notifications.",
      "not-configured": "Notifications aren't set up for this version of the app yet.",
      unsupported: "This browser can't show notifications. On iPhone, add VITO Physio to your Home Screen first.",
      denied: "Notifications are blocked. Allow them in your phone or browser settings, then try again.",
    };
    toast.info(messages[result.status]);
  }

  async function turnOff() {
    const saved = storedDeviceToken();
    if (saved) await unregister({ data: saved });
    await disableDevicePush();
    forgetDeviceToken();
    setEnabled(false);
    toast.success("Notifications turned off on this device.");
  }

  async function onChange(next: boolean) {
    setBusy(true);
    try {
      await (next ? turnOn() : turnOff());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <span className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
          <Smartphone className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold">Phone notifications</span>
          <span className="block text-xs text-muted-foreground">
            Pop-up alerts on this device, even when VITO Physio is closed.
          </span>
        </span>
      </span>
      <Switch
        checked={enabled}
        disabled={busy}
        onCheckedChange={(v) => void onChange(v)}
        aria-label="Phone notifications"
      />
    </label>
  );
}
