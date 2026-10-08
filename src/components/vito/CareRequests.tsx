import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KIND: Record<string, string> = { appointment: "Appointment", consultation: "Consultation", follow_up: "Follow-up" };

/** Requests sent from the athlete home page. Staff schedule (creates an appointment) or decline; athletes see status. */
export function CareRequests({ staff, userId }: { staff: boolean; userId: string }) {
  const qc = useQueryClient();
  const [when, setWhen] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["care-requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_requests")
        .select("id, kind, message, status, response, created_at, athlete_id, athletes(first_name, surname, athlete_code)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  async function respond(id: string, athleteId: string, kind: string, schedule: boolean) {
    try {
      let appointment_id: string | null = null;
      if (schedule) {
        if (!when[id]) throw new Error("Pick a date and time first.");
        const { data, error } = await supabase.from("appointments").insert({ athlete_id: athleteId, scheduled_at: new Date(when[id]).toISOString(), purpose: KIND[kind] ?? kind, status: "scheduled", created_by: userId }).select("id").single();
        if (error) throw error;
        appointment_id = data.id;
      }
      const { error } = await supabase.from("care_requests").update({ status: schedule ? "scheduled" : "declined", appointment_id, handled_by: userId, response: schedule ? `Scheduled for ${new Date(when[id] ?? "").toLocaleString()}` : "Please contact the clinic." }).eq("id", id);
      if (error) throw error;
      toast.success(schedule ? "Appointment scheduled" : "Request declined");
      qc.invalidateQueries({ queryKey: ["care-requests"] });
      qc.invalidateQueries({ queryKey: ["athlete-health"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
  }
  const rows = q.data ?? [];
  if (!rows.length) return <p className="text-sm text-muted-foreground">{staff ? "No athlete requests waiting." : "You have not sent any requests yet."}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b>{KIND[r.kind] ?? r.kind}{staff && r.athletes ? ` · ${r.athletes.first_name} ${r.athletes.surname} (${r.athletes.athlete_code})` : ""}</b>
            <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "pending" ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>{r.status}</span>
          </div>
          <p className="mt-1 text-muted-foreground">{r.message}</p>
          {r.response && <p className="mt-1 text-primary">{r.response}</p>}
          {staff && r.status === "pending" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Input type="datetime-local" className="w-auto" value={when[r.id] ?? ""} onChange={(e) => setWhen({ ...when, [r.id]: e.target.value })} />
              <Button size="sm" onClick={() => respond(r.id, r.athlete_id, r.kind, true)}>Schedule</Button>
              <Button size="sm" variant="outline" onClick={() => respond(r.id, r.athlete_id, r.kind, false)}>Decline</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
