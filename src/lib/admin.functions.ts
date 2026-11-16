import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accountDeletionBlock, athleteRecordDeletionBlock } from "@/lib/account-deletion";

async function adminLevel(supabase: any, userId: string) {
  const [{ data: sup }, { data: vito }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "vito_admin" }),
  ]);
  if (sup) return "super" as const;
  if (vito) return "vito" as const;
  throw new Error("Forbidden");
}

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const level = await adminLevel(context.supabase, context.userId);
    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
      await Promise.all([
        context.supabase
          .from("profiles")
          .select("id, account_code, full_name, email, requested_role, avatar_path, created_at")
          .order("created_at", { ascending: false }),
        context.supabase.from("user_roles").select("user_id, role"),
      ]);
    if (profilesError || rolesError) {
      throw new Error("Accounts could not be loaded. Please try again.");
    }
    return {
      level,
      me: context.userId,
      accounts: (profiles ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? "athlete",
      })),
    };
  });

export const listDeliveryLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminLevel(context.supabase, context.userId);
    const { data: logs, error } = await (context.supabase as any)
      .from("delivery_logs")
      .select(
        "id, consultation_request_id, channel, status, provider_message_id, error_message, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Delivery status could not be loaded.");
    const rows = logs ?? [];
    return {
      logs: rows,
      summary: {
        total: rows.length,
        sent: rows.filter((row: { status: string }) => row.status === "sent").length,
        failed: rows.filter((row: { status: string }) => row.status === "failed").length,
        skipped: rows.filter((row: { status: string }) => row.status === "skipped").length,
        email: rows.filter((row: { channel: string }) => row.channel === "email").length,
        whatsapp: rows.filter((row: { channel: string }) => row.channel === "whatsapp").length,
      },
    };
  });

export const sendAdminEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        audience: z.enum([
          "selected",
          "all",
          "staff",
          "athletes",
          "parents",
          "coaches",
          "school_admins",
        ]),
        recipientIds: z.array(z.string().uuid()).max(250).default([]),
        subject: z.string().trim().min(3).max(160),
        message: z.string().trim().min(10).max(10000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await adminLevel(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] =
      await Promise.all([
        (supabaseAdmin as any).from("profiles").select("id, email").not("email", "is", null),
        (supabaseAdmin as any).from("user_roles").select("user_id, role"),
      ]);
    if (profileError || roleError) throw new Error("Recipients could not be loaded.");
    const roleByUser = new Map<string, string>(
      (roles ?? []).map((role: { user_id: string; role: string }) => [role.user_id, role.role]),
    );
    const allowedRoles: Record<string, string[]> = {
      staff: ["super_admin", "vito_admin", "clinical_professional", "clinical_supervisor"],
      athletes: ["athlete"],
      parents: ["parent"],
      coaches: ["coach"],
      school_admins: ["school_admin"],
    };
    const recipients = (profiles ?? [])
      .filter((profile: { id: string; email: string | null }) => {
        if (!profile.email) return false;
        if (data.audience === "selected") return data.recipientIds.includes(profile.id);
        if (data.audience === "all") return true;
        return allowedRoles[data.audience]?.includes(roleByUser.get(profile.id) ?? "") ?? false;
      })
      .map((profile: { id: string; email: string }) => ({ id: profile.id, email: profile.email }));
    if (!recipients.length) throw new Error("No users with email addresses match this audience.");
    const { sendAdminEmails } = await import("@/lib/notification-delivery");
    return sendAdminEmails({ recipients, subject: data.subject, message: data.message });
  });

export const approveAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), approve: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const level = await adminLevel(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("requested_role")
      .eq("id", data.userId)
      .single();
    const req = p?.requested_role;
    if (req !== "vito_admin" && req !== "clinical_professional")
      throw new Error("No pending request.");
    if (req === "vito_admin" && level !== "super")
      throw new Error("Only the super admin can approve VITO admins.");
    if (data.approve) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ role: req })
        .eq("user_id", data.userId);
      if (error) throw error;
    }
    await supabaseAdmin
      .from("profiles")
      .update({ requested_role: data.approve ? `${req}:approved` : `${req}:declined` })
      .eq("id", data.userId);
    return { ok: true };
  });

export const removeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const level = await adminLevel(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: r } = await admin.from("user_roles").select("role").eq("user_id", data.userId);
    const roles = (r ?? []).map((x: { role: string }) => x.role);
    const blocked = accountDeletionBlock(level, context.userId, data.userId, roles);
    if (blocked) throw new Error(blocked);
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, account_code")
      .eq("id", data.userId)
      .maybeSingle();
    // The athlete's own self-registered record goes with their account (clinical rows cascade).
    const { data: own } = await admin
      .from("athlete_guardians")
      .select("athlete_id, athletes!inner(self_registered)")
      .eq("user_id", data.userId)
      .eq("relationship", "self");
    const ownAthleteIds = (own ?? [])
      .filter((g: any) => g.athletes?.self_registered)
      .map((g: any) => g.athlete_id);
    // Sent chat messages block auth deletion, so remove them first.
    const { error: msgError } = await admin.from("messages").delete().eq("sender_id", data.userId);
    if (msgError) throw new Error("The account's messages could not be removed.");
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error && !/not found/i.test(error.message)) {
      console.error("deleteUser failed", error);
      throw new Error("Account could not be removed.");
    }
    await Promise.all([
      admin.from("user_roles").delete().eq("user_id", data.userId),
      admin.from("school_users").delete().eq("user_id", data.userId),
      admin.from("athlete_guardians").delete().eq("user_id", data.userId),
      admin.from("profiles").delete().eq("id", data.userId),
    ]);
    if (ownAthleteIds.length) await admin.from("athletes").delete().in("id", ownAthleteIds);
    await admin.from("sensitive_access_log").insert({
      actor_id: context.userId,
      action: "account_deleted",
      detail: { user_id: data.userId, ...profile, athlete_records_deleted: ownAthleteIds.length },
    });
    return { ok: true };
  });

export const removeAthleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ athleteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const level = await adminLevel(context.supabase, context.userId);
    const blocked = athleteRecordDeletionBlock(level);
    if (blocked) throw new Error(blocked);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: athlete } = await admin
      .from("athletes")
      .select("athlete_code, first_name, surname")
      .eq("id", data.athleteId)
      .maybeSingle();
    if (!athlete) throw new Error("Athlete record not found.");
    const { data: docs } = await admin
      .from("documents")
      .select("storage_path")
      .eq("athlete_id", data.athleteId);
    const paths = (docs ?? []).map((d: { storage_path: string }) => d.storage_path).filter(Boolean);
    const { error } = await admin.from("athletes").delete().eq("id", data.athleteId);
    if (error) {
      console.error("athlete delete failed", error);
      throw new Error("Athlete record could not be deleted.");
    }
    if (paths.length) await admin.storage.from("case-documents").remove(paths);
    await admin.from("sensitive_access_log").insert({
      actor_id: context.userId,
      action: "athlete_record_deleted",
      detail: { athlete_id: data.athleteId, ...athlete },
    });
    return { ok: true };
  });
