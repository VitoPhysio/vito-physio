import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const emailConsultationConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request, error } = await context.supabase
      .from("consultation_requests")
      .select(
        "id, contact_name, email, requester_user_id, assigned_to, accepted_mode, scheduled_at, meeting_details, status",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error || !request) throw new Error("Consultation request could not be loaded.");
    if (request.assigned_to !== context.userId || request.status !== "confirmed") {
      throw new Error("Only the assigned clinician can send these confirmed meeting details.");
    }
    if (!request.accepted_mode || !request.scheduled_at || !request.meeting_details) {
      throw new Error("The consultation meeting details are incomplete.");
    }
    const { sendConsultationConfirmationEmail } = await import("@/lib/notification-delivery");
    return sendConsultationConfirmationEmail({
      consultationRequestId: request.id,
      recipientUserId: request.requester_user_id,
      to: request.email,
      contactName: request.contact_name,
      acceptedMode: request.accepted_mode,
      scheduledAt: request.scheduled_at,
      meetingDetails: request.meeting_details,
    });
  });
