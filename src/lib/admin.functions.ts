import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, account_code, full_name, email, requested_role, avatar_path, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: logs, error } = await (supabaseAdmin as any)
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
    const roleByUser = new Map(
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
    if (data.userId === context.userId) throw new Error("You cannot remove your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const roles = (r ?? []).map((x) => x.role);
    if (roles.includes("super_admin")) throw new Error("The super admin cannot be removed.");
    if (roles.includes("vito_admin") && level !== "super")
      throw new Error("Only the super admin can remove VITO admins.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Account could not be removed.");
    await Promise.all([
      supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId),
      supabaseAdmin.from("school_users").delete().eq("user_id", data.userId),
      supabaseAdmin.from("athlete_guardians").delete().eq("user_id", data.userId),
      supabaseAdmin.from("profiles").delete().eq("id", data.userId),
    ]);
    return { ok: true };
  });
