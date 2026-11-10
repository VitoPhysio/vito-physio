import { createFileRoute } from "@tanstack/react-router";
import { deliveryOutcome, notificationPath, pushBody } from "@/lib/notification-policy";

export const Route = createFileRoute("/api/public/notification-delivery")({
  server: { handlers: { POST: async ({ request }) => {
    // External scheduler/webhook only: do not accept ordinary user JWTs.
    const webhookSecret = process.env["NOTIFICATION_WEBHOOK_SECRET"];
    if (!webhookSecret || request.headers.get("Authorization") !== `Bearer ${webhookSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
    if (!apiKey || !connectionKey) return Response.json({ error: "Push connection missing" }, { status: 503 });
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: jobs, error } = await db.from("notification_deliveries")
      .select("*").eq("status", "queued").lte("next_attempt_at", now).limit(20);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    let sent = 0;
    for (const job of jobs ?? []) {
      const lease = new Date(Date.now() + 120_000).toISOString();
      const { data: claimed, error: claimError } = await db.from("notification_deliveries")
        .update({ next_attempt_at: lease, updated_at: lease, attempt_count: job.attempt_count + 1 })
        .eq("id", job.id).eq("updated_at", job.updated_at).select("id").maybeSingle();
      if (claimError || !claimed) continue;
      const [notification, device] = await Promise.all([
        db.from("notifications").select("*").eq("id", job.notification_id).maybeSingle(),
        job.device_token_id ? db.from("user_device_tokens").select("*").eq("id", job.device_token_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      const n = notification.data;
      const d = device.data;
      if (notification.error || device.error) continue; // lease expires; retry without losing the job
      const prefs = n ? await db.from("notification_preferences").select("*").eq("user_id", n.user_id).maybeSingle() : null;
      if (prefs?.error) continue;
      const categoryKey = n ? `${n.category}_enabled` : "";
      const allowed = prefs?.data as Record<string, unknown> | null | undefined;
      if (!n || !d || n.user_id !== d.user_id || d.disabled_at || n.read_at || allowed?.["push_enabled"] === false || allowed?.[categoryKey] === false) {
        await db.from("notification_deliveries").update({ status: "skipped", updated_at: now }).eq("id", job.id);
        continue;
      }
      try {
        const response = await fetch("https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send", {
          method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { token: d.token, data: { title: n.title, body: pushBody(n.category, n.body), path: notificationPath(n.path), tag: n.id } } }),
        });
        if (!response.ok) {
          const text = await response.text();
          console.error(`FCM delivery failed [${response.status}]: ${text}`);
          let code: string | undefined;
          try { code = JSON.parse(text).error?.details?.find((item: { errorCode?: string }) => item.errorCode)?.errorCode; } catch {}
          const outcome = deliveryOutcome(response.status, code);
          if (outcome === "disable") await db.from("user_device_tokens").update({ disabled_at: now }).eq("id", d.id);
          await db.from("notification_deliveries").update({ status: outcome === "retry" ? "queued" : "failed", last_error: `${response.status}: ${text}`.slice(0, 1000), updated_at: lease, next_attempt_at: new Date(Date.now() + Math.min(3600_000, 30_000 * 2 ** Math.min(job.attempt_count, 7))).toISOString() }).eq("id", job.id);
          continue;
        }
        const result = await response.json() as { name?: string };
        const { error: saved } = await db.from("notification_deliveries").update({ status: "sent", provider_message_id: result.name ?? null, last_error: null, updated_at: now }).eq("id", job.id);
        if (!saved) sent++;
      } catch (failure) {
        await db.from("notification_deliveries").update({ last_error: String(failure).slice(0, 1000), next_attempt_at: lease, updated_at: lease }).eq("id", job.id);
      }
    }
    return Response.json({ processed: jobs?.length ?? 0, sent }, { headers: { "Cache-Control": "no-store" } });
  } } },
});