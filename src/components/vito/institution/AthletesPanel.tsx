import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoAvatar } from "@/components/vito/Photo";
import { ageAt, parseAthleteCsv, type AthleteImportRow } from "@/lib/injury-analytics";
import { institutionPermissions, MESSAGE_KIND_LABEL, REFERRAL_STATUS_LABEL } from "@/lib/institution";
import {
  athleteStatus, fmtDate, fullName, instRpc, LoadError, Loading, Panel, selectCls, StatusPill,
  useInstitutionAthletes, useTeams, type InstAthlete,
} from "./shared";

type Perms = ReturnType<typeof institutionPermissions>;

export function AthletesPanel({ school, perms, athleteId, onOpen }: { school: string; perms: Perms; athleteId?: string | undefined; onOpen: (id?: string) => void }) {
  if (athleteId) return <AthleteProfile school={school} athleteId={athleteId} perms={perms} onBack={() => onOpen(undefined)} />;
  return <AthleteDirectory school={school} perms={perms} onOpen={onOpen} />;
}

function AthleteDirectory({ school, perms, onOpen }: { school: string; perms: Perms; onOpen: (id: string) => void }) {
  const { data: athletes, isLoading, error } = useInstitutionAthletes(school);
  const { data: teams = [] } = useTeams(school);
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [team, setTeam] = useState("");
  const [status, setStatus] = useState("");
  const sports = useMemo(() => [...new Set((athletes ?? []).map((a) => a.sport?.trim()).filter(Boolean) as string[])].sort(), [athletes]);
  const list = (athletes ?? []).filter((a) => {
    const text = `${fullName(a)} ${a.athlete_code}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (sport && a.sport?.trim() !== sport) return false;
    if (team && !a.team_ids.includes(team)) return false;
    if (status && athleteStatus(a).label !== status) return false;
    return true;
  });
  if (isLoading) return <Loading what="athletes" />;
  if (error) return <LoadError error={error} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search name or athlete ID" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search athletes" />
        <select aria-label="Sport" className={selectCls} value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="">All sports</option>{sports.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Team" className={selectCls} value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">All teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="Status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>{["Available", "Injured", "In rehabilitation", "Recovered"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          {perms.manageAthletes && <RegisterAthleteDialog school={school} />}
          {perms.manageAthletes && <ImportAthletesDialog school={school} />}
        </div>
      </div>
      {!perms.manageAthletes && <p className="text-xs text-muted-foreground">As a coach you see athletes in the teams you coach.</p>}
      <p className="text-sm text-muted-foreground">{list.length} of {athletes?.length ?? 0} athletes</p>
      {list.length === 0 ? (
        <Panel><p className="text-sm text-muted-foreground">{athletes?.length ? "No athletes match these filters." : "No athletes are registered under this institution yet."}</p></Panel>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Athlete</th><th className="p-3">Age</th><th className="p-3">Gender</th><th className="p-3">Sport</th><th className="p-3">Team / class</th><th className="p-3">Coach</th><th className="p-3">Status</th><th className="p-3">Registered</th></tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const st = athleteStatus(a);
                return (
                  <tr key={a.id} className="cursor-pointer border-t hover:bg-secondary/40" onClick={() => onOpen(a.id)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <PhotoAvatar path={a.photo_path} name={fullName(a)} className="size-8" />
                        <div><p className="font-semibold">{fullName(a)}</p><p className="text-xs text-muted-foreground">{a.athlete_code}</p></div>
                      </div>
                    </td>
                    <td className="p-3">{ageAt(a.date_of_birth, new Date().toISOString()) ?? "—"}</td>
                    <td className="p-3 capitalize">{a.gender ?? "—"}</td>
                    <td className="p-3">{a.sport ?? "—"}</td>
                    <td className="p-3">{a.teams.join(", ") || "—"}</td>
                    <td className="p-3">{a.coaches.join(", ") || "—"}</td>
                    <td className="p-3"><StatusPill tone={st.tone}>{st.label}</StatusPill>{a.rehab_phase && <p className="text-xs text-muted-foreground">{a.rehab_phase}</p>}</td>
                    <td className="p-3">{fmtDate(a.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function useInvalidateAthletes(school: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["inst-athletes", school] });
    void qc.invalidateQueries({ queryKey: ["inst-teams", school] });
    void qc.invalidateQueries({ queryKey: ["institution-overview", school] });
  };
}

function RegisterAthleteDialog({ school }: { school: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: teams = [] } = useTeams(school);
  const refresh = useInvalidateAthletes(school);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const row = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const res = await instRpc<{ created: number; problems: { reason: string }[] }>("institution_register_athletes", { _school: school, _rows: [row] });
      if (res.created) { toast.success("Athlete registered"); refresh(); setOpen(false); }
      else toast.error(res.problems[0]?.reason ?? "Athlete was not registered");
    } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><UserPlus className="mr-1 size-4" />Register athlete</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Register an athlete</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field name="first_name" label="First name" required />
          <Field name="surname" label="Surname" required />
          <Field name="date_of_birth" label="Date of birth" type="date" />
          <label className="grid gap-1 text-sm"><span>Gender</span>
            <select name="gender" className={selectCls}><option value="">Not recorded</option><option value="female">Female</option><option value="male">Male</option></select>
          </label>
          <Field name="sport" label="Sport" />
          <Field name="competition_level" label="Level / class" />
          <Field name="phone" label="Phone" />
          <label className="grid gap-1 text-sm"><span>Team / class</span>
            <select name="team_id" className={selectCls}><option value="">None</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">An athlete ID is created automatically. Duplicates (same name and date of birth) are refused.</p>
          <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? "Saving…" : "Register athlete"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ name, label, type = "text", required, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | null }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Input id={`f-${name}`} name={name} type={type} required={required} defaultValue={defaultValue ?? ""} maxLength={80} />
    </div>
  );
}

function ImportAthletesDialog({ school }: { school: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useInvalidateAthletes(school);
  const parsed = useMemo(() => (text.trim() ? parseAthleteCsv(text) : { rows: [] as AthleteImportRow[], errors: [] as string[] }), [text]);
  async function submit() {
    setBusy(true);
    try {
      const res = await instRpc<{ created: number; skipped: number; problems: { row: number; reason: string }[] }>("institution_register_athletes", { _school: school, _rows: parsed.rows });
      toast.success(`${res.created} registered, ${res.skipped} skipped`);
      refresh();
      if (!res.skipped) { setOpen(false); setText(""); }
      else setText(`Skipped:\n${res.problems.map((p) => `Row ${p.row}: ${p.reason}`).join("\n")}`);
    } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Upload className="mr-1 size-4" />Import</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Import athletes from a spreadsheet</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Upload a CSV file or paste rows copied from a spreadsheet. Columns: First name, Surname, Sport, Date of birth (YYYY-MM-DD), Gender, Phone, Level.</p>
        <Input type="file" accept=".csv,text/csv,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"First name,Surname,Sport,Date of birth\nJane,Akello,Netball,2011-02-03"} />
        {parsed.errors.length > 0 && <ul className="max-h-24 overflow-auto text-xs text-destructive">{parsed.errors.map((er) => <li key={er}>{er}</li>)}</ul>}
        <Button onClick={submit} disabled={busy || parsed.rows.length === 0}>{busy ? "Importing…" : `Register ${parsed.rows.length} athlete${parsed.rows.length === 1 ? "" : "s"}`}</Button>
      </DialogContent>
    </Dialog>
  );
}

type Profile = {
  athlete: InstAthlete & { has_account: boolean };
  teams: { id: string; name: string; kind: string; coach: string | null }[];
  injuries: { id: string; injury_code: string; body_region: string; injury_type: string | null; severity: string | null; status: string; injury_date: string; resolved_at: string | null; days_lost: number | null; activity_context: string | null; is_recurrence: boolean | null }[];
  assessments: { id: string; date: string; type: string | null; follow_up_date: string | null }[];
  rehabilitation: { id: string; injury_id: string; phase: string | null; start_date: string | null; target_return_date: string | null }[];
  exercises: { name: string; sets: number | null; reps: string | null; frequency: string | null }[];
  follow_ups: { review_date: string; pain_score: number | null }[];
  recovery_updates: { status: string; created_at: string }[];
  appointments: { scheduled_at: string; purpose: string | null; status: string; location: string | null }[];
  referrals: { id: string; referral_code: string; referred_to: string; status: string; consent_status: string; created_at: string }[];
  communications: { subject: string | null; kind: string | null; body: string; created_at: string }[];
};

function AthleteProfile({ school, athleteId, perms, onBack }: { school: string; athleteId: string; perms: Perms; onBack: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["inst-athlete-profile", school, athleteId],
    queryFn: () => instRpc<Profile>("institution_athlete_profile", { _school: school, _athlete: athleteId }),
  });
  if (isLoading) return <Loading what="athlete profile" />;
  if (error || !data?.athlete) return <div className="space-y-2"><Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-1 size-4" />Back</Button><LoadError error={error} /></div>;
  const a = data.athlete;
  const active = data.injuries.filter((i) => !["closed", "resolved", "recovered"].includes(i.status));
  const st = athleteStatus({ active_injuries: active.length, total_injuries: data.injuries.length, rehab_phase: data.rehabilitation.find((r) => active.some((i) => i.id === r.injury_id))?.phase ?? null });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-1 size-4" />All athletes</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 size-4" />Print</Button>
        </div>
      </div>
      <div className="print-report space-y-4">
        <Panel>
          <div className="flex flex-wrap items-center gap-4">
            <PhotoAvatar path={a.photo_path} name={fullName(a)} className="size-16" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black">{fullName(a)}</h2>
              <p className="text-sm text-muted-foreground">{a.athlete_code} · {a.sport ?? "Sport not set"}{a.competition_level ? ` · ${a.competition_level}` : ""}</p>
              <div className="mt-1 flex flex-wrap gap-2"><StatusPill tone={st.tone}>{st.label}</StatusPill>{!a.has_account && <StatusPill tone="info">No athlete account linked</StatusPill>}</div>
            </div>
            {perms.manageAthletes && <EditAthleteDialog school={school} athlete={a} />}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Info k="Date of birth" v={fmtDate(a.date_of_birth)} />
            <Info k="Age" v={String(ageAt(a.date_of_birth, new Date().toISOString()) ?? "—")} />
            <Info k="Gender" v={a.gender ?? "—"} />
            <Info k="Registered" v={fmtDate(a.created_at)} />
            <Info k="Teams / classes" v={data.teams.map((t) => t.name).join(", ") || "—"} />
            <Info k="Coach" v={[...new Set(data.teams.map((t) => t.coach).filter(Boolean))].join(", ") || "—"} />
            {a.phone && <Info k="Phone" v={a.phone} />}
          </dl>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={`Injury history (${data.injuries.length})`}>
            <List empty="No injuries recorded." items={data.injuries.map((i) => (
              <div key={i.id} className="flex flex-wrap justify-between gap-2">
                <span><b>{i.body_region}</b>{i.injury_type ? ` · ${i.injury_type}` : ""}{i.severity ? ` · ${i.severity}` : ""}{i.is_recurrence ? " · recurrence" : ""}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(i.injury_date)} · {i.status}{i.days_lost ? ` · ${i.days_lost} days lost` : ""}</span>
              </div>
            ))} />
          </Panel>
          <Panel title="Rehabilitation progress">
            <List empty="No rehabilitation plan yet." items={data.rehabilitation.map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-2"><span>{r.phase ?? "Plan"}</span><span className="text-xs text-muted-foreground">Started {fmtDate(r.start_date)} · target return {fmtDate(r.target_return_date)}</span></div>
            ))} />
            {data.follow_ups.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Last review {fmtDate(data.follow_ups[0]?.review_date)}{data.follow_ups[0]?.pain_score != null ? ` · pain ${data.follow_ups[0]?.pain_score}/10` : ""}</p>}
            {data.recovery_updates[0] && <p className="text-xs text-muted-foreground">Latest recovery update: {data.recovery_updates[0].status} ({fmtDate(data.recovery_updates[0].created_at)})</p>}
          </Panel>
          <Panel title="Assessments">
            <p className="mb-2 text-xs text-muted-foreground">Dates only. Clinical findings stay confidential to VITO clinicians unless shared through a consented referral.</p>
            <List empty="No assessments yet." items={data.assessments.map((s) => <div key={s.id} className="flex justify-between"><span>{s.type ?? "Assessment"}</span><span className="text-xs text-muted-foreground">{fmtDate(s.date)}</span></div>)} />
          </Panel>
          <Panel title="Treatment and exercises">
            <List empty="No exercises prescribed." items={data.exercises.map((e, i) => <div key={i}>{e.name}<span className="text-xs text-muted-foreground">{[e.sets && `${e.sets} sets`, e.reps && `${e.reps} reps`, e.frequency].filter(Boolean).map((x) => ` · ${x}`).join("")}</span></div>)} />
          </Panel>
          <Panel title="Appointments">
            <List empty="No appointments." items={data.appointments.map((ap, i) => <div key={i} className="flex flex-wrap justify-between gap-2"><span>{ap.purpose ?? "Appointment"}{ap.location ? ` · ${ap.location}` : ""}</span><span className="text-xs text-muted-foreground">{new Date(ap.scheduled_at).toLocaleString()} · {ap.status}</span></div>)} />
          </Panel>
          <Panel title="Referrals">
            <List empty="No referrals from this institution." items={data.referrals.map((r) => <div key={r.id} className="flex flex-wrap justify-between gap-2"><span>{r.referred_to}</span><span className="text-xs text-muted-foreground">{REFERRAL_STATUS_LABEL[r.status] ?? r.status} · {fmtDate(r.created_at)}</span></div>)} />
          </Panel>
          <Panel title="Communication history" className="lg:col-span-2">
            <List empty="No institution messages yet." items={data.communications.map((c, i) => <div key={i}><p className="text-xs text-muted-foreground">{MESSAGE_KIND_LABEL[c.kind ?? "message"] ?? "Message"} · {new Date(c.created_at).toLocaleString()}</p><p>{c.subject ? <b>{c.subject}: </b> : null}{c.body}</p></div>)} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium capitalize-first">{v}</dd></div>;
}
function List({ items, empty }: { items: React.ReactNode[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="space-y-2 text-sm">{items.map((it, i) => <li key={i} className="border-b pb-2 last:border-0">{it}</li>)}</ul>;
}

function EditAthleteDialog({ school, athlete }: { school: string; athlete: InstAthlete }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      await instRpc("institution_update_athlete", { _school: school, _athlete: athlete.id, _sport: f["sport"], _gender: f["gender"], _competition_level: f["competition_level"], _phone: f["phone"] });
      toast.success("Athlete updated");
      void qc.invalidateQueries({ queryKey: ["inst-athlete-profile", school, athlete.id] });
      void qc.invalidateQueries({ queryKey: ["inst-athletes", school] });
      setOpen(false);
    } catch (err) { toast.error((err as Error).message); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="print:hidden">Edit details</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit participation details</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field name="sport" label="Sport" defaultValue={athlete.sport} />
          <label className="grid gap-1 text-sm"><span>Gender</span>
            <select name="gender" defaultValue={athlete.gender ?? ""} className={selectCls}><option value="">Not recorded</option><option value="female">Female</option><option value="male">Male</option></select>
          </label>
          <Field name="competition_level" label="Level / class" defaultValue={athlete.competition_level} />
          <Field name="phone" label="Phone" defaultValue={athlete.phone} />
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
