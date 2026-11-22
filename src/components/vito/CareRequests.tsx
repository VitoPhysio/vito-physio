import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { careRequestDestination, CARE_REQUEST_KIND } from "@/lib/care-requests";

type Mode = { as: "staff" } | { as: "athlete" } | { as: "institution"; school: string };

/**
 * Athlete care requests, shared by three dashboards:
 * - athlete: own requests and their answers
 * - staff (VITO): requests to the clinical team — schedule or decline
 * - institution: requests addressed to that institution — acknowledge, schedule, decline or close
 * Every answer is delivered into the athlete's Workspace inbox by the database.
 */
export function CareRequests({ staff, userId, mode }: { staff?: boolean; userId: string; mode?: Mode }) {
  const m: Mode = mode ?? (staff ? { as: "staff" } : { as: "athlete" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [when, setWhen] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const school = m.as === "institution" ? m.school : null;
  const q = useQuery({
    queryKey: ["care-requests", userId, m.as, school],
    queryFn: async () => {
      let query = supabase
        .from("care_requests")
        .select("id, kind, message, status, response, created_at, athlete_id, requester_id, handled_by, school_id, schools(name), athletes(first_name, surname, athlete_code)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (school) query = query.eq("school_id", school);
      if (m.as === "staff") query = query.is("school_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["care-requests"] });
    qc.invalidateQueries({ queryKey: ["athlete-health"] });
  };

  async function staffRespond(id: string, athleteId: string, kind: string, schedule: boolean) {
    try {
      let appointment_id: string | null = null;
      if (schedule) {
        if (!when[id]) throw new Error("Pick a date and time first.");
        const { data, error } = await supabase.from("appointments").insert({ athlete_id: athleteId, scheduled_at: new Date(when[id]).toISOString(), purpose: CARE_REQUEST_KIND[kind] ?? kind, status: "scheduled", created_by: userId }).select("id").single();
        if (error) throw error;
        appointment_id = data.id;
      }
      const extra = note[id]?.trim();
      const response = [schedule ? `Scheduled for ${new Date(when[id] ?? "").toLocaleString()}` : "Please contact the clinic.", extra].filter(Boolean).join(" — ");
      const { error } = await supabase.from("care_requests").update({ status: schedule ? "scheduled" : "declined", appointment_id, handled_by: userId, response }).eq("id", id);
      if (error) throw error;
      toast.success(schedule ? "Appointment scheduled — the athlete gets it in their Workspace inbox" : "Request declined");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
  }

  async function institutionRespond(id: string, status: "acknowledged" | "scheduled" | "declined" | "closed") {
    const extra = note[id]?.trim();
    const response = [status === "scheduled" && when[id] ? `Scheduled for ${new Date(when[id]).toLocaleString()}` : null, extra].filter(Boolean).join(" — ");
    if (status === "scheduled" && !response) return void toast.error("Add a date/time or a note first.");
    const { error } = await supabase.rpc("institution_respond_care_request", { _id: id, _status: status, _response: response });
    if (error) return void toast.error(error.message);
    toast.success("Answer sent to the athlete's Workspace inbox");
    refresh();
  }

  async function openThread(other: string | null) {
    if (!other || other === userId) return;
    const { data, error } = await supabase.rpc("create_workspace_conversation", { _other_user: other });
    if (error || !data) return void toast.error(error?.message ?? "Could not open the conversation");
    void navigate({ to: "/messages", search: { conversation: data, box: "workspace" } });
  }

  const rows = q.data ?? [];
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading requests…</p>;
  if (q.error) return <p className="text-sm text-destructive">Requests could not be loaded.</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">{m.as === "athlete" ? "You have not sent any requests yet." : "No athlete requests waiting."}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const open = r.status === "pending" || r.status === "acknowledged";
        const counterpart = m.as === "athlete" ? r.handled_by : r.requester_id;
        return (
          <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>
                {CARE_REQUEST_KIND[r.kind] ?? r.kind}
                {m.as !== "athlete" && r.athletes ? ` · ${r.athletes.first_name} ${r.athletes.surname} (${r.athletes.athlete_code})` : ""}
              </b>
              <span className={`rounded-full px-2 py-0.5 text-xs ${open ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>{r.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {m.as === "athlete" ? `To ${careRequestDestination(r.schools?.name ?? null)}` : "From the athlete home page"} · {new Date(r.created_at).toLocaleString()}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.message}</p>
            {r.response && <p className="mt-1 text-primary">{r.response}</p>}
            {m.as !== "athlete" && open && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input type="datetime-local" className="w-auto" aria-label="Date and time" value={when[r.id] ?? ""} onChange={(e) => setWhen({ ...when, [r.id]: e.target.value })} />
                <Input className="min-w-40 flex-1" placeholder="Note to the athlete (optional)" maxLength={1000} value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                {m.as === "staff" ? (
                  <>
                    <Button size="sm" onClick={() => staffRespond(r.id, r.athlete_id, r.kind, true)}>Schedule</Button>
                    <Button size="sm" variant="outline" onClick={() => staffRespond(r.id, r.athlete_id, r.kind, false)}>Decline</Button>
                  </>
                ) : (
                  <>
                    {r.status === "pending" && <Button size="sm" variant="secondary" onClick={() => institutionRespond(r.id, "acknowledged")}>Acknowledge</Button>}
                    <Button size="sm" onClick={() => institutionRespond(r.id, "scheduled")}>Schedule</Button>
                    <Button size="sm" variant="outline" onClick={() => institutionRespond(r.id, "declined")}>Decline</Button>
                    <Button size="sm" variant="ghost" onClick={() => institutionRespond(r.id, "closed")}>Close</Button>
                  </>
                )}
              </div>
            )}
            {counterpart && counterpart !== userId && (
              <Button size="sm" variant="link" className="mt-1 h-auto px-0" onClick={() => void openThread(counterpart)}>
                {m.as === "athlete" ? "Reply in Workspace inbox" : "Message the athlete"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
