import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { institutionPermissions } from "@/lib/institution";
import { fullName, instRpc, LoadError, Loading, Panel, selectCls, useInstitutionAthletes, useMembers, useTeams, type InstTeam } from "./shared";

export function TeamsPanel({ school, perms }: { school: string; perms: ReturnType<typeof institutionPermissions> }) {
  const { data: teams, isLoading, error } = useTeams(school);
  const { data: athletes = [] } = useInstitutionAthletes(school);
  const [editing, setEditing] = useState<InstTeam | "new" | null>(null);
  const qc = useQueryClient();
  if (isLoading) return <Loading what="teams" />;
  if (error) return <LoadError error={error} />;
  async function remove(t: InstTeam) {
    if (!confirm(`Delete ${t.name}? Athletes stay registered.`)) return;
    try {
      await instRpc("institution_delete_team", { _team: t.id });
      void qc.invalidateQueries({ queryKey: ["inst-teams", school] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete team");
    }
  }
  return (
    <Panel title="Teams and classes" action={perms.manageTeams && <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> New team</Button>}>
      {!teams?.length ? (
        <p className="text-sm text-muted-foreground">{perms.manageTeams ? "No teams yet. Create one and assign a coach and athletes." : "You are not assigned to any team yet. Ask an institution administrator."}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {teams.map((t) => (
            <li key={t.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.kind === "class" ? "Class" : "Team"}{t.sport ? ` · ${t.sport}` : ""} · Coach: {t.coach_name ?? "none"}</p>
                </div>
                {perms.manageTeams && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => void remove(t)}><Trash2 className="size-4" /></Button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm">{t.athlete_ids.length} athletes{t.athlete_ids.length ? `: ${athletes.filter((a) => t.athlete_ids.includes(a.id)).slice(0, 6).map(fullName).join(", ")}${t.athlete_ids.length > 6 ? "…" : ""}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
      {editing && <TeamDialog school={school} team={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function TeamDialog({ school, team, onClose }: { school: string; team: InstTeam | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: members = [] } = useMembers(school);
  const { data: athletes = [] } = useInstitutionAthletes(school);
  const [f, setF] = useState({ name: team?.name ?? "", kind: team?.kind ?? "team", sport: team?.sport ?? "", coach: team?.coach_id ?? "" });
  const [picked, setPicked] = useState<Set<string>>(new Set(team?.athlete_ids ?? []));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const coaches = members.filter((m) => m.status === "active");
  async function save() {
    if (!f.name.trim()) return void toast.error("Enter a team name.");
    setBusy(true);
    try {
      const id = await instRpc<string>("institution_save_team", { _school: school, _team: team?.id ?? null, _name: f.name.trim(), _kind: f.kind, _sport: f.sport.trim(), _coach: f.coach || null });
      await instRpc("institution_set_team_athletes", { _team: id, _athletes: [...picked] });
      toast.success("Team saved");
      void qc.invalidateQueries({ queryKey: ["inst-teams", school] });
      void qc.invalidateQueries({ queryKey: ["inst-athletes", school] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save team");
    } finally {
      setBusy(false);
    }
  }
  const shown = athletes.filter((a) => `${fullName(a)} ${a.athlete_code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{team ? "Edit team" : "New team"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1">Name<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Label>
          <div className="grid grid-cols-2 gap-3">
            <Label className="grid gap-1">Kind
              <select className={selectCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="team">Team</option><option value="class">Class</option></select>
            </Label>
            <Label className="grid gap-1">Sport<Input value={f.sport} onChange={(e) => setF({ ...f, sport: e.target.value })} /></Label>
          </div>
          <Label className="grid gap-1">Coach
            <select className={selectCls} value={f.coach} onChange={(e) => setF({ ...f, coach: e.target.value })}>
              <option value="">No coach</option>
              {coaches.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? "Member"}{m.role === "school_admin" ? " (admin)" : ""}</option>)}
            </select>
          </Label>
          <div className="grid gap-1">
            <Label>Athletes ({picked.size})</Label>
            <Input placeholder="Search athletes" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
              {shown.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={picked.has(a.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(a.id); else n.delete(a.id); setPicked(n); }} />
                  {fullName(a)} <span className="text-xs text-muted-foreground">{a.athlete_code}</span>
                </label>
              ))}
              {!shown.length && <p className="text-xs text-muted-foreground">No athletes found.</p>}
            </div>
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save team"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
