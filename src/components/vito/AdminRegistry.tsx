import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhotoAvatar } from "@/components/vito/Photo";

/** Requests to join an already-registered school, club or academy. Approving links the account. */
export function JoinRequests({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["join-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_join_requests").select("id, role, status, created_at, user_id, schools(name, school_code, school_type)").eq("status", "pending").order("created_at");
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id);
      const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, email, avatar_path").in("id", ids) : { data: [] };
      return (data ?? []).map((r) => ({ ...r, person: people?.find((p) => p.id === r.user_id) }));
    },
  });
  async function decide(id: string, approve: boolean) {
    const { error } = await supabase.from("org_join_requests").update({ status: approve ? "approved" : "declined", handled_by: userId }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Approved — account linked" : "Declined");
    qc.invalidateQueries({ queryKey: ["join-requests"] });
  }
  const rows = q.data ?? [];
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Requests to join a school, club or academy ({rows.length})</h2>
      {rows.length ? <ul className="space-y-2">{rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-accent bg-card p-3 text-sm">
          <span className="flex items-center gap-3"><PhotoAvatar path={r.person?.avatar_path} name={r.person?.full_name ?? null} /><span><b>{r.person?.full_name ?? "—"}</b><br /><span className="text-xs text-muted-foreground">{r.person?.email} · wants to join <b>{r.schools?.name}</b> ({r.schools?.school_code}) as {r.role === "coach" ? "coach" : "admin"}</span></span></span>
          <span className="flex gap-2"><Button size="sm" onClick={() => decide(r.id, true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Decline</Button></span>
        </li>))}</ul> : <p className="text-sm text-muted-foreground">No pending join requests.</p>}
    </section>
  );
}

/** Every registered athlete (self sign-ups included), searchable by name, ID, sport or organisation. */
export function AthleteRegistry() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["athlete-registry"],
    queryFn: async () => {
      const { data, error } = await supabase.from("athletes").select("id, athlete_code, first_name, surname, sport, gender, photo_path, self_registered, created_at, schools(name, school_type)").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = (list.data ?? []).filter((a) => `${a.first_name} ${a.surname} ${a.athlete_code} ${a.sport ?? ""} ${a.schools?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Registered athletes ({list.data?.length ?? 0})</h2><Input placeholder="Search name, athlete ID, sport or school" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" /></div>
      <ul className="space-y-2">{rows.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
          <span className="flex items-center gap-3"><PhotoAvatar path={a.photo_path} name={`${a.first_name} ${a.surname}`} /><span><b>{a.first_name} {a.surname}</b><br /><span className="text-xs text-muted-foreground">{a.athlete_code} · {a.sport || "Sport not set"} · {a.schools?.name ?? "No school/club"}</span></span></span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a.self_registered ? "Self-registered" : "Added by VITO"}</span>
        </li>))}
        {!rows.length && <li className="text-sm text-muted-foreground">No athletes found.</li>}
      </ul>
    </section>
  );
}
