export type ConsultationAlert = {
  id: string;
  contact_name: string;
  email: string;
  phone?: string;
  organisation_type: string;
  message: string;
};

type DeliveryChannel = "email" | "whatsapp";
type DeliveryStatus = "sent" | "failed" | "skipped";
type DeliverySource = "consultation" | "admin_email";

const COMPANY_EMAIL = "vitophysio256@gmail.com";
const COMPANY_WHATSAPP = "256774234739";

function formatAlert(alert: ConsultationAlert) {
  return [
    "New VITO Physio consultation / inquiry",
    `Name: ${alert.contact_name}`,
    `Email: ${alert.email}`,
    `Phone: ${alert.phone || "Not provided"}`,
    `Contact type: ${alert.organisation_type}`,
    `Request ID: ${alert.id}`,
    "",
    alert.message,
  ].join("\n");
}

async function recordDelivery({
  consultationRequestId,
  recipientUserId,
  source,
  channel,
  subject,
  status,
  providerMessageId,
  errorMessage,
}: {
  consultationRequestId?: string;
  recipientUserId?: string;
  source: DeliverySource;
  channel: DeliveryChannel;
  subject?: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any).from("delivery_logs").insert({
    consultation_request_id: consultationRequestId || null,
    recipient_user_id: recipientUserId || null,
    source,
    channel,
    subject: subject || null,
    status,
    provider_message_id: providerMessageId || null,
    error_message: errorMessage?.slice(0, 500) || null,
  });
  if (error) console.error(`[delivery] could not record ${channel} status`, error);
}

async function parseProviderResult(response: Response) {
  let payload: { id?: string; message?: string; error?: { message?: string } } = {};
  try {
    payload = await response.json();
  } catch {
    /* provider returned no JSON */
  }
  return {
    id: payload.id,
    error: payload.message || payload.error?.message || `HTTP ${response.status}`,
  };
}

async function sendResendEmail({
  to,
  subject,
  text,
  recipientUserId,
  source,
}: {
  to: string;
  subject: string;
  text: string;
  recipientUserId?: string;
  source: DeliverySource;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    await recordDelivery({
      recipientUserId,
      source,
      channel: "email",
      subject,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured",
    });
    return { status: "skipped" as const };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "VITO Physio <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
    });
    const result = await parseProviderResult(response);
    await recordDelivery({
      recipientUserId,
      source,
      channel: "email",
      subject,
      status: response.ok ? "sent" : "failed",
      providerMessageId: result.id,
      errorMessage: response.ok ? undefined : result.error,
    });
    return { status: response.ok ? ("sent" as const) : ("failed" as const) };
  } catch (error) {
    await recordDelivery({
      recipientUserId,
      source,
      channel: "email",
      subject,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Email request failed",
    });
    return { status: "failed" as const };
  }
}

export async function sendConsultationAlerts(alert: ConsultationAlert) {
  const message = formatAlert(alert);
  const [email, whatsapp] = await Promise.all([
    sendResendEmail({
      to: COMPANY_EMAIL,
      subject: `New consultation / inquiry from ${alert.contact_name}`,
      text: message,
      source: "consultation",
    }),
    sendConsultationWhatsApp(alert, message),
  ]);
  return { email, whatsapp };
}

async function sendConsultationWhatsApp(alert: ConsultationAlert, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    await recordDelivery({
      consultationRequestId: alert.id,
      source: "consultation",
      channel: "whatsapp",
      status: "skipped",
      errorMessage: "Twilio WhatsApp credentials are not configured",
    });
    return { status: "skipped" as const };
  }
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
          To: `whatsapp:+${COMPANY_WHATSAPP}`,
          Body: message.slice(0, 1500),
        }).toString(),
      },
    );
    const result = await parseProviderResult(response);
    await recordDelivery({
      consultationRequestId: alert.id,
      source: "consultation",
      channel: "whatsapp",
      status: response.ok ? "sent" : "failed",
      providerMessageId: result.id,
      errorMessage: response.ok ? undefined : result.error,
    });
    return { status: response.ok ? ("sent" as const) : ("failed" as const) };
  } catch (error) {
    await recordDelivery({
      consultationRequestId: alert.id,
      source: "consultation",
      channel: "whatsapp",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "WhatsApp request failed",
    });
    return { status: "failed" as const };
  }
}

export async function sendAdminEmails({
  recipients,
  subject,
  message,
}: {
  recipients: Array<{ id: string; email: string }>;
  subject: string;
  message: string;
}) {
  const results = await Promise.all(
    recipients.map((recipient) =>
      sendResendEmail({
        to: recipient.email,
        subject,
        text: message,
        recipientUserId: recipient.id,
        source: "admin_email",
      }),
    ),
  );
  return {
    total: results.length,
    sent: results.filter((result) => result.status === "sent").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
  };
}
