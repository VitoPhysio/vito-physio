import {
  buildFcmMessage,
  conversationPath,
  deliveryOutcome,
  messagePushContent,
  notificationPath,
  pushBody,
} from "@/lib/notification-policy";

const FCM_URL = "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type SendResult = { ok: true; name: string | null } | { ok: false; status: number; text: string; code?: string | undefined };

async function sendFcm(apiKey: string, connectionKey: string, message: unknown): Promise<SendResult> {
  const response = await fetch(FCM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (response.ok) {
    const result = (await response.json()) as { name?: string };
    return { ok: true, name: result.name ?? null };
  }
  const text = await response.text();
  console.error(`FCM delivery failed [${response.status}]: ${text}`);
  let code: string | undefined;
  try {
    code = JSON.parse(text).error?.details?.find((item: { errorCode?: string }) => item.errorCode)?.errorCode;
  } catch {}
  return { ok: false, status: response.status, text, code };
}

function backoff(attempts: number) {
  return new Date(Date.now() + Math.min(3600_000, 30_000 * 2 ** Math.min(attempts, 7))).toISOString();
}

/** General (bell) notifications → devices. Chat messages never pass through here. */
async function processBellQueue(db: Db, apiKey: string, connectionKey: string) {
  const now = new Date().toISOString();
  const { data: jobs, error } = await db.from("notification_deliveries")
    .select("*").eq("status", "queued").lte("next_attempt_at", now).limit(20);
  if (error) return { processed: 0, sent: 0, error: error.message };
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
    if (notification.error || device.error) continue;
    const prefs = n ? await db.from("notification_preferences").select("*").eq("user_id", n.user_id).maybeSingle() : null;
    if (prefs?.error) continue;
    const allowed = prefs?.data as Record<string, unknown> | null | undefined;
    if (!n || !d || n.category === "messages" || n.user_id !== d.user_id || d.disabled_at || n.read_at || allowed?.["push_enabled"] === false || allowed?.[`${n.category}_enabled`] === false) {
      await db.from("notification_deliveries").update({ status: "skipped", updated_at: now }).eq("id", job.id);
      continue;
    }
    try {
      const result = await sendFcm(apiKey, connectionKey, buildFcmMessage({
        token: d.token, platform: d.platform, title: n.title, body: pushBody(n.category, n.body), path: notificationPath(n.path), tag: n.id,
      }));
      if (!result.ok) {
        const outcome = deliveryOutcome(result.status, result.code);
        if (outcome === "disable") await db.from("user_device_tokens").update({ disabled_at: now }).eq("id", d.id);
        await db.from("notification_deliveries").update({ status: outcome === "retry" ? "queued" : "failed", last_error: `${result.status}: ${result.text}`.slice(0, 1000), updated_at: lease, next_attempt_at: backoff(job.attempt_count) }).eq("id", job.id);
        continue;
      }
      const { error: saved } = await db.from("notification_deliveries").update({ status: "sent", provider_message_id: result.name, last_error: null, updated_at: now }).eq("id", job.id);
      if (!saved) sent++;
    } catch (failure) {
      await db.from("notification_deliveries").update({ last_error: String(failure).slice(0, 1000), next_attempt_at: lease, updated_at: lease }).eq("id", job.id);
    }
  }
  return { processed: jobs?.length ?? 0, sent };
}

/** Chat messages → devices. Independent of the notification bell; tapping opens the conversation. */
async function processMessageQueue(db: Db, apiKey: string, connectionKey: string) {
  const now = new Date().toISOString();
  const { data: jobs, error } = await db.from("message_push_deliveries")
    .select("*").eq("status", "queued").lte("next_attempt_at", now).limit(30);
  if (error) return { processed: 0, sent: 0, error: error.message };
  let sent = 0;
  for (const job of jobs ?? []) {
    const lease = new Date(Date.now() + 120_000).toISOString();
    const { data: claimed } = await db.from("message_push_deliveries")
      .update({ next_attempt_at: lease, updated_at: lease, attempt_count: job.attempt_count + 1 })
      .eq("id", job.id).eq("updated_at", job.updated_at).select("id").maybeSingle();
    if (!claimed) continue;
    const [{ data: m, error: mErr }, { data: d, error: dErr }, { data: prefs, error: pErr }] = await Promise.all([
      db.from("messages").select("id,conversation_id,sender_id,body,created_at,deleted_at,attachment_name").eq("id", job.message_id).maybeSingle(),
      db.from("user_device_tokens").select("*").eq("id", job.device_token_id).maybeSingle(),
      db.from("notification_preferences").select("push_enabled,messages_enabled,message_preview_enabled").eq("user_id", job.recipient_id).maybeSingle(),
    ]);
    if (mErr || dErr || pErr) continue;
    const [{ data: member }, { data: convo }, { data: sender }] = m
      ? await Promise.all([
          db.from("conversation_participants").select("last_read_at").eq("conversation_id", m.conversation_id).eq("user_id", job.recipient_id).maybeSingle(),
          db.from("conversations").select("kind").eq("id", m.conversation_id).maybeSingle(),
          db.from("profiles").select("full_name").eq("id", m.sender_id).maybeSingle(),
        ])
      : [{ data: null }, { data: null }, { data: null }];
    // Skip if already read (recipient had the chat open), removed, or opted out — avoids duplicate alerts.
    const alreadyRead = Boolean(m && member?.last_read_at && member.last_read_at >= m.created_at);
    if (!m || !d || !member || m.deleted_at || d.disabled_at || d.user_id !== job.recipient_id || alreadyRead || prefs?.push_enabled === false || prefs?.messages_enabled === false) {
      await db.from("message_push_deliveries").update({ status: "skipped", updated_at: now }).eq("id", job.id);
      continue;
    }
    const content = messagePushContent({
      senderName: sender?.full_name ?? null,
      body: m.body,
      attachmentName: m.attachment_name,
      isGroup: convo?.kind === "group",
      showPreview: prefs?.message_preview_enabled !== false,
    });
    try {
      const result = await sendFcm(apiKey, connectionKey, buildFcmMessage({
        token: d.token, platform: d.platform, title: content.title, body: content.body,
        path: conversationPath(m.conversation_id), tag: `conversation-${m.conversation_id}`,
      }));
      if (!result.ok) {
        const outcome = deliveryOutcome(result.status, result.code);
        if (outcome === "disable") await db.from("user_device_tokens").update({ disabled_at: now }).eq("id", d.id);
        await db.from("message_push_deliveries").update({ status: outcome === "retry" ? "queued" : "failed", last_error: `${result.status}: ${result.text}`.slice(0, 1000), updated_at: lease, next_attempt_at: backoff(job.attempt_count) }).eq("id", job.id);
        continue;
      }
      const { error: saved } = await db.from("message_push_deliveries").update({ status: "sent", provider_message_id: result.name, last_error: null, updated_at: now }).eq("id", job.id);
      if (!saved) sent++;
    } catch (failure) {
      await db.from("message_push_deliveries").update({ last_error: String(failure).slice(0, 1000), next_attempt_at: lease, updated_at: lease }).eq("id", job.id);
    }
  }
  return { processed: jobs?.length ?? 0, sent };
}

/** Sends queued chat and general pushes through Firebase. Server-only. */
export async function processPushQueue(): Promise<{ processed: number; sent: number; error?: string | undefined }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!apiKey || !connectionKey) return { processed: 0, sent: 0, error: "Push connection missing" };
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [chat, bell] = await Promise.all([
    processMessageQueue(db, apiKey, connectionKey),
    processBellQueue(db, apiKey, connectionKey),
  ]);
  const error = [chat.error, bell.error].filter(Boolean).join("; ") || undefined;
  return { processed: chat.processed + bell.processed, sent: chat.sent + bell.sent, error };
}
