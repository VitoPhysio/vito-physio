import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { InstitutionWorkspace } from "@/components/vito/institution/InstitutionWorkspace";
import { normalizeSection, WORKSPACE_SECTIONS } from "@/lib/institution";

export const Route = createFileRoute("/_authenticated/workspace/$institutionId")({
  validateSearch: z.object({ section: z.enum(WORKSPACE_SECTIONS).optional().catch(undefined), athlete: z.string().uuid().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Institution dashboard — VITO Physio" },
      { name: "description", content: "Overview, members and settings for your school, club or academy on VITO Physio." },
      { property: "og:title", content: "Institution dashboard — VITO Physio" },
      { property: "og:description", content: "Institution overview, membership and settings on VITO Physio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const { institutionId } = Route.useParams();
  const { section, athlete } = Route.useSearch();
  return <InstitutionWorkspace key={institutionId} institutionId={institutionId} section={normalizeSection(section)} athleteId={athlete} />;
}
