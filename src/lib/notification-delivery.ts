export type ConsultationAlert = {
  id: string;
  contact_name: string;
  email: string;
  phone?: string;
  organisation_type: string;
  message: string;
};

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

export async function sendConsultationAlerts(alert: ConsultationAlert) {
  const message = formatAlert(alert);
  const tasks: Promise<Response | void>[] = [];

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    tasks.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "VITO Physio <onboarding@resend.dev>",
          to: [COMPANY_EMAIL],
          subject: `New consultation / inquiry from ${alert.contact_name}`,
          text: message,
        }),
      }),
    );
  } else {
    console.warn("[delivery] RESEND_API_KEY is not configured; email alert skipped.");
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (sid && token && from) {
    tasks.push(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
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
      }),
    );
  } else {
    console.warn(
      "[delivery] Twilio WhatsApp credentials are not configured; WhatsApp alert skipped.",
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected")
      console.error("[delivery] consultation alert failed", result.reason);
  });
}
