import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { memberProfileInput, profileKind } from "./member-profile";

export const loadMemberProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: { supabase, userId } }) => {
    const [profile, community, roles] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_path").eq("id", userId).single(),
      supabase.from("community_profiles").select("headline, position, sport, school_name, team, district, country, bio, skills, interests, discoverable, visibility").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profile.error || community.error || roles.error) throw new Error("Your profile could not be loaded.");
    return { profile: profile.data, community: community.data, kind: profileKind((roles.data ?? []).map((r) => r.role)) };
  });

export const saveMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => memberProfileInput.parse(input))
  .handler(async ({ data, context: { supabase, userId } }) => {
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (roles.error) throw new Error("Your account role could not be checked.");
    if (profileKind((roles.data ?? []).map((r) => r.role)) === "athlete") throw new Error("Use your athlete profile settings.");
    const { full_name, ...community } = data;
    const saved = await supabase.from("community_profiles").upsert({ ...community, user_id: userId }, { onConflict: "user_id" });
    if (saved.error) throw new Error(`Profile details could not be saved: ${saved.error.message}`);
    const name = await supabase.from("profiles").update({ full_name }).eq("id", userId).select("id").single();
    if (name.error) throw new Error(`Profile name could not be saved: ${name.error.message}`);
    return { ok: true };
  });
