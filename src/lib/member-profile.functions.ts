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
    const kind = profileKind((roles.data ?? []).map((r) => r.role));
    const institutions = kind === "organisation" ? await supabase.rpc("my_institutions") : null;
    if (institutions?.error) throw new Error("Your institution could not be loaded.");
    const institution = institutions?.data?.find((i) => i.role === "school_admin") ?? null;
    return { profile: profile.data, community: community.data, kind, institution };
  });

export const saveMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => memberProfileInput.parse(input))
  .handler(async ({ data, context: { supabase, userId } }) => {
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (roles.error) throw new Error("Your account role could not be checked.");
    const kind = profileKind((roles.data ?? []).map((r) => r.role));
    if (kind === "athlete") throw new Error("Use your athlete profile settings.");
    let { full_name, ...community } = data;
    let school_id: string | undefined;
    if (kind === "organisation") {
      const institutions = await supabase.rpc("my_institutions");
      if (institutions.error) throw new Error("Your institution could not be checked.");
      const institution = institutions.data?.find((i) => i.role === "school_admin");
      if (!institution) throw new Error("Your institution administrator must approve your access before you edit its profile.");
      full_name = institution.name;
      community = { ...community, school_name: institution.name };
      school_id = institution.id;
    }
    const saved = await supabase.from("community_profiles").upsert({ ...community, ...(school_id ? { school_id } : {}), user_id: userId }, { onConflict: "user_id" });
    if (saved.error) throw new Error(`Profile details could not be saved: ${saved.error.message}`);
    const name = await supabase.from("profiles").update({ full_name }).eq("id", userId).select("id").single();
    if (name.error) throw new Error(`Profile name could not be saved: ${name.error.message}`);
    return { ok: true };
  });
