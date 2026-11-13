import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACTION_TOKEN_PREFIX } from "@/lib/notification-actions";

const preferencesInput = z.object({
  messages_enabled: z.boolean(),
  reactions_enabled: z.boolean(),
  comments_enabled: z.boolean(),
  followers_enabled: z.boolean(),
  mentions_enabled: z.boolean(),
  appointments_enabled: z.boolean(),
  rehabilitation_enabled: z.boolean(),
  push_enabled: z.boolean(),
  message_preview_enabled: z.boolean().default(true),
});

export type NotificationPreferences = z.output<typeof preferencesInput>;

export const saveNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => preferencesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notification_preferences").upsert({
      user_id: context.userId,
      ...data,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

const tokenInput = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["web", "android", "ios"]).default("web"),
  androidActions: z.boolean().optional(),
});

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_device_tokens").upsert(
      {
        user_id: context.userId,
        token: data.platform === "android" && data.androidActions ? `${ACTION_TOKEN_PREFIX}${data.token}` : data.token,
        platform: data.platform,
        last_seen_at: new Date().toISOString(),
        disabled_at: null,
      },
      { onConflict: "user_id,token" },
    );
    if (error) throw new Error(error.message);
    if (data.platform === "android" && data.androidActions) {
      await context.supabase.from("user_device_tokens").update({ disabled_at: new Date().toISOString() }).eq("user_id", context.userId).eq("token", data.token);
    }
    return { registered: true };
  });

export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_device_tokens")
      .update({ disabled_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .in("token", [data.token, `${ACTION_TOKEN_PREFIX}${data.token}`]);
    if (error) throw new Error(error.message);
    return { registered: false };
  });

/** Wakes the push queue right after in-app activity; it only delivers already-queued pushes to their own recipients. */
export const dispatchPendingPushes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { processPushQueue } = await import("./push-delivery.server");
    const result = await processPushQueue();
    return { sent: result.sent };
  });
