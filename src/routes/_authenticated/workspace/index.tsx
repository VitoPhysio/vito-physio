import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { InstitutionEntry } from "@/components/vito/institution/InstitutionEntry";
import { canEnterInstitutionWorkspace, pickInitialInstitution } from "@/lib/institution";

export const Route = createFileRoute("/_authenticated/workspace/")({
  validateSearch: z.object({ add: z.boolean().optional() }),
  head: () => ({
    meta: [
      { title: "Institution workspace — VITO Physio" },
      { name: "description", content: "Choose, join or register the school, club or academy you manage on VITO Physio." },
      { property: "og:title", content: "Institution workspace — VITO Physio" },
      { property: "og:description", content: "Manage schools, clubs and academies in one VITO Physio account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ context, search }) => {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (!canEnterInstitutionWorkspace((roles ?? []).map((r) => r.role))) throw redirect({ to: "/dashboard" });
    if (search.add) return;
    const { data } = await supabase.rpc("my_institutions");
    const target = pickInitialInstitution((data ?? []).map((i) => i.id));
    if (target) throw redirect({ to: "/workspace/$institutionId", params: { institutionId: target } });
  },
  component: WorkspaceEntry,
});

function WorkspaceEntry() {
  const { add } = Route.useSearch();
  return <InstitutionEntry addMode={!!add} />;
}
