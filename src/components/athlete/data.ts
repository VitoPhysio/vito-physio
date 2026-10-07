import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getMyAssessments } from "@/lib/athlete.functions";

type T<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Row"];
export type MemberCard = Database["public"]["Functions"]["get_member_cards"]["Returns"][number];
export type CommunityProfile = T<"community_profiles">;
export type Connection = T<"connections">;

export const STAFF_ROLES = ["super_admin", "vito_admin", "clinical_professional", "clinical_supervisor"];

/** Who is signed in: name, photo and role. Shared by the portal nav and pages. */
export function useViewer(user: User) {
  return useQuery({
    queryKey: ["viewer", user.id],
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_path, account_code").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const role = roles?.[0]?.role ?? "athlete";
      const name = profile?.full_name ?? user.email ?? "";
      return { name, firstName: name.split(" ")[0] ?? name, avatar: profile?.avatar_path ?? null, accountCode: profile?.account_code ?? null, role, isAthlete: role === "athlete", isStaff: STAFF_ROLES.includes(role) };
    },
  });
}

/* ---------------------------- Health & injury ---------------------------- */

/** Recovery stages used by the clinical team's "Recovery status" workflow. */
export const RECOVERY_TRACK = ["new", "assessed", "in rehab", "modified training", "return to play", "recovered"] as const;
export const STAGE_LABEL: Record<string, string> = {
  new: "Reported", assessed: "Assessed", "in rehab": "In rehab", "modified training": "Modified training",
  "return to play": "Return to play", recovered: "Recovered", referred: "Referred on",
};
export function stageProgress(status: string) {
  const i = RECOVERY_TRACK.indexOf(status as (typeof RECOVERY_TRACK)[number]);
  if (status === "referred") return 20;
  return i < 0 ? 0 : Math.round((i / (RECOVERY_TRACK.length - 1)) * 100);
}
const CLOSED_APPOINTMENT = ["cancelled", "completed", "attended", "missed"];

export function useHealth(userId: string) {
  return useQuery({
    queryKey: ["athlete-health", userId],
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("athlete_guardians")
        .select("athlete_id, relationship, athletes(id, first_name, surname, athlete_code, sport, photo_path, school_id)")
        .eq("user_id", userId);
      if (error) throw error;
      const athletes = (links ?? []).flatMap((l) => (l.athletes ? [{ ...l.athletes, relationship: l.relationship }] : []));
      const ids = athletes.map((a) => a.id);
      if (!ids.length) return { athletes, linked: false as const, ...emptyHealth() };

      const [inj, plans, ex, fu, rec, apt, asm] = await Promise.all([
        supabase.from("injuries").select("id, injury_code, athlete_id, body_region, mechanism, status, injury_date, pain_score, sport_context, created_by, created_at, updated_at").in("athlete_id", ids).order("created_at", { ascending: false }),
        supabase.from("rehabilitation_plans").select("*").in("athlete_id", ids).order("created_at", { ascending: false }),
        supabase.from("exercises").select("*").in("athlete_id", ids).order("created_at"),
        supabase.from("follow_ups").select("*").in("athlete_id", ids).order("review_date", { ascending: false }),
        supabase.from("recovery_updates").select("*").in("athlete_id", ids).order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").in("athlete_id", ids).order("scheduled_at"),
        getMyAssessments().catch(() => [] as Awaited<ReturnType<typeof getMyAssessments>>),
      ]);
      const injuries = inj.data ?? [];
      const rehab = plans.data ?? [];
      const exercises = ex.data ?? [];
      const followUps = fu.data ?? [];
      const recovery = rec.data ?? [];
      const appointments = apt.data ?? [];
      const assessments = asm ?? [];

      const now = Date.now();
      const active = injuries.filter((i) => i.status !== "recovered");
      const upcoming = appointments.filter((a) => new Date(a.scheduled_at).getTime() >= now - 60 * 60 * 1000 && !CLOSED_APPOINTMENT.includes(a.status.toLowerCase()));
      const dueFollowUps = [
        ...followUps.filter((f) => new Date(f.review_date).getTime() >= now - 86400000).map((f) => ({ date: f.review_date, injury_id: f.injury_id, source: "Follow-up review" })),
        ...assessments.filter((a) => a.follow_up_date && new Date(a.follow_up_date).getTime() >= now - 86400000).map((a) => ({ date: a.follow_up_date!, injury_id: a.injury_id, source: "Assessment follow-up" })),
      ].sort((a, b) => a.date.localeCompare(b.date));

      const timeline = [
        ...assessments.map((a) => ({ id: a.id, at: a.assessment_date ?? "", kind: "assessment" as const, title: `${a.assessment_type || "Injury"} assessment completed`, injury_id: a.injury_id })),
        ...recovery.map((r) => ({ id: r.id, at: r.created_at, kind: "recovery" as const, title: `Recovery status: ${STAGE_LABEL[r.status] ?? r.status}`, injury_id: r.injury_id })),
        ...followUps.filter((f) => new Date(f.review_date).getTime() < now).map((f) => ({ id: f.id, at: f.review_date, kind: "followup" as const, title: "Follow-up review recorded", injury_id: f.injury_id })),
        ...rehab.map((p) => ({ id: p.id, at: p.created_at, kind: "rehab" as const, title: `Rehabilitation plan ${p.phase ? `· ${p.phase}` : "created"}`, injury_id: p.injury_id })),
      ].filter((t) => t.at).sort((a, b) => b.at.localeCompare(a.at));

      const staffIds = [...new Set([...injuries, ...rehab, ...appointments, ...followUps, ...recovery, ...assessments].map((r) => r.created_by).filter((id): id is string => Boolean(id) && id !== userId))];
      const { data: names } = staffIds.length ? await supabase.rpc("get_sender_names", { _ids: staffIds }) : { data: [] };
      const careTeam = (names ?? []).map((n) => ({ id: n.id, name: n.full_name ?? "VITO clinician", isAdmin: n.is_admin }));

      return { athletes, linked: true as const, injuries, active, rehab, exercises, followUps, recovery, appointments, upcoming, assessments, dueFollowUps, timeline, careTeam };
    },
  });
}

function emptyHealth() {
  return {
    injuries: [], active: [], rehab: [], exercises: [], followUps: [], recovery: [], appointments: [], upcoming: [], assessments: [], dueFollowUps: [], timeline: [], careTeam: [],
  } as unknown as Omit<NonNullable<Awaited<ReturnType<typeof loadShape>>>, "athletes" | "linked">;
}
// Type helper only — gives emptyHealth() the same shape as the loaded data.
declare function loadShape(): Promise<{
  injuries: Array<Pick<T<"injuries">, "id" | "injury_code" | "athlete_id" | "body_region" | "mechanism" | "status" | "injury_date" | "pain_score" | "sport_context" | "created_by" | "created_at" | "updated_at">>;
  active: Array<Pick<T<"injuries">, "id" | "injury_code" | "athlete_id" | "body_region" | "mechanism" | "status" | "injury_date" | "pain_score" | "sport_context" | "created_by" | "created_at" | "updated_at">>;
  rehab: T<"rehabilitation_plans">[]; exercises: T<"exercises">[]; followUps: T<"follow_ups">[]; recovery: T<"recovery_updates">[];
  appointments: T<"appointments">[]; upcoming: T<"appointments">[];
  assessments: Awaited<ReturnType<typeof getMyAssessments>>;
  dueFollowUps: { date: string; injury_id: string; source: string }[];
  timeline: { id: string; at: string; kind: "assessment" | "recovery" | "followup" | "rehab"; title: string; injury_id: string }[];
  careTeam: { id: string; name: string; isAdmin: boolean }[];
}>;

/* ------------------------------- Community ------------------------------- */

export async function memberCards(ids: string[]): Promise<Map<string, MemberCard>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data } = await supabase.rpc("get_member_cards", { _ids: unique });
  return new Map((data ?? []).map((c) => [c.id, c]));
}

/** The signed-in member's community profile and connections. `ready` is false until the community tables exist. */
export function useNetwork(userId: string) {
  return useQuery({
    queryKey: ["network", userId],
    queryFn: async () => {
      const [mine, conns] = await Promise.all([
        supabase.from("community_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("connections").select("*").order("created_at", { ascending: false }),
      ]);
      if (mine.error || conns.error) return { ready: false, profile: null, connections: [], incoming: [], outgoing: [], cards: new Map<string, MemberCard>(), statusOf: () => "none" as ConnectionState };
      const rows = conns.data ?? [];
      const other = (c: Connection) => (c.requester_id === userId ? c.addressee_id : c.requester_id);
      const cards = await memberCards([...rows.map(other), userId]);
      const withCard = (c: Connection) => ({ ...c, otherId: other(c), card: cards.get(other(c)) ?? null });
      const accepted = rows.filter((c) => c.status === "accepted").map(withCard);
      const incoming = rows.filter((c) => c.status === "pending" && c.addressee_id === userId).map(withCard);
      const outgoing = rows.filter((c) => c.status === "pending" && c.requester_id === userId).map(withCard);
      const byOther = new Map(rows.map((c) => [other(c), c]));
      const statusOf = (id: string): ConnectionState => {
        const c = byOther.get(id);
        if (!c) return "none";
        if (c.status === "accepted") return "connected";
        return c.requester_id === userId ? "sent" : "received";
      };
      return { ready: true, profile: mine.data, connections: accepted, incoming, outgoing, cards, statusOf, connectionFor: (id: string) => byOther.get(id) ?? null };
    },
  });
}
export type ConnectionState = "none" | "sent" | "received" | "connected";

/** Connection actions; each one refreshes the network data. */
export function useConnectionActions(userId: string) {
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["network", userId] }); qc.invalidateQueries({ queryKey: ["activity"] }); };
  return {
    async request(addresseeId: string) {
      const { error } = await supabase.from("connections").insert({ requester_id: userId, addressee_id: addresseeId });
      if (error) toast.error(error.code === "23505" ? "A connection already exists." : "Could not send the request."); else toast.success("Connection request sent");
      refresh();
    },
    async accept(connectionId: string) {
      const { error } = await supabase.from("connections").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", connectionId);
      if (error) toast.error("Could not accept the request."); else toast.success("Connected");
      refresh();
    },
    async remove(connectionId: string, message = "Connection removed") {
      const { error } = await supabase.from("connections").delete().eq("id", connectionId);
      if (error) toast.error("Could not update the connection."); else toast.success(message);
      refresh();
    },
  };
}

/** Activity from the member and their connections; falls back to community highlights. */
export function useActivity(userId: string, connectedIds: string[] | undefined, authorId?: string) {
  return useQuery({
    queryKey: ["activity", userId, authorId ?? "feed", connectedIds?.join(",") ?? ""],
    enabled: connectedIds !== undefined,
    queryFn: async () => {
      let q = supabase.from("community_activity").select("*").order("created_at", { ascending: false }).limit(40);
      if (authorId) q = q.eq("author_id", authorId);
      const { data, error } = await q;
      if (error) return { items: [], scope: "none" as const };
      const circle = new Set([userId, ...(connectedIds ?? [])]);
      const mine = authorId ? data ?? [] : (data ?? []).filter((a) => circle.has(a.author_id));
      const scope = authorId || mine.length ? ("network" as const) : ("community" as const);
      const items = (scope === "network" ? mine : data ?? []).slice(0, 20);
      const cards = await memberCards(items.map((i) => i.author_id));
      return { items: items.map((i) => ({ ...i, author: cards.get(i.author_id) ?? null })), scope };
    },
  });
}

export const MILESTONES = [
  "Completed my rehabilitation programme",
  "Back in full training",
  "Returned to competition",
  "Reached a recovery milestone",
] as const;

export const ROLE_TITLE: Record<string, string> = {
  athlete: "Athlete", coach: "Coach", school_admin: "School / club", parent: "Parent", clinical_professional: "Clinician",
  clinical_supervisor: "Clinical supervisor", vito_admin: "VITO", super_admin: "VITO",
};

export function useSchoolsDirectory(q?: string) {
  return useQuery({
    queryKey: ["schools-directory", q ?? ""],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("discover_schools", { _q: q?.trim() || null });
      if (error) return [];
      return data ?? [];
    },
  });
}
