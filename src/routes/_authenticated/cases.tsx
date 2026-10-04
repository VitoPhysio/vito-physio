import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleForm, clean, type Field } from "@/components/vito/SimpleForm";
import { Compose } from "@/components/vito/Communications";
import logo from "@/assets/vito-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/cases")({
  head: () => ({ meta: [{ title: "Case workspace — VITO Physio" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("is_vito_staff", { _user_id: context.user.id });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: CasesPage,
});

type Step = "schools" | "athletes" | "open" | "manage";
const STEPS: { v: Step; l: string }[] = [
  { v: "schools", l: "1. Schools" },
  { v: "athletes", l: "2. Athletes" },
  { v: "open", l: "3. Open a case" },
  { v: "manage", l: "4. Manage a case" },
];

function useRegistry() {
  return useQuery({
    queryKey: ["registry"],
    queryFn: async () => {
      const [s, a] = await Promise.all([
        supabase.from("schools").select("*").order("name"),
        supabase.from("athletes").select("*, schools(name, school_code)").order("surname"),
      ]);
      if (s.error) throw s.error;
      if (a.error) throw a.error;
      return { schools: s.data, athletes: a.data };
    },
  });
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function CasesPage() {
  const [step, setStep] = useState<Step>("schools");
  const { user } = Route.useRouteContext();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <img src={logo.url} alt="VITO Physio" className="h-10 w-10" />
            <h1 className="text-lg font-bold text-primary">Clinician case workspace</h1>
          </div>
          <Button asChild variant="outline"><Link to="/dashboard">Return to dashboard</Link></Button>
        </div>
        <nav className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-5 pb-4 sm:grid-cols-4">
          {STEPS.map((s) => (
            <Button key={s.v} variant={step === s.v ? "default" : "outline"} onClick={() => setStep(s.v)}>{s.l}</Button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
        {step === "schools" && <SchoolsStep userId={user.id} />}
        {step === "athletes" && <AthletesStep userId={user.id} />}
        {step === "open" && <OpenCaseStep userId={user.id} onOpened={() => setStep("manage")} />}
        {step === "manage" && <ManageStep userId={user.id} />}
      </main>
    </div>
  );
}

/* ---------- Step 1: Schools ---------- */
function SchoolsStep({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data } = useRegistry();
  const [q, setQ] = useState("");
  const fields: Field[] = [
    { name: "name", label: "Name", required: true },
    { name: "school_type", label: "Type", type: "select", required: true, options: [
      { value: "school", label: "School" }, { value: "academy", label: "Academy" }, { value: "club", label: "Club" }] },
    { name: "location", label: "Location" },
    { name: "contact_phone", label: "Contact phone" },
    { name: "intake_notes", label: "Notes", type: "textarea" },
  ];
  const list = (data?.schools ?? []).filter((s) => `${s.name} ${s.school_code} ${s.location ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Panel title="Register a school, academy or club">
        <SimpleForm fields={fields} submitLabel="Register" initial={{ school_type: "school" }} onSubmit={async (v) => {
          const { data: row, error } = await supabase.from("schools").insert({ ...(clean(v) as { name: string }), created_by: userId }).select("school_code").single();
          if (error) { toast.error(error.message); throw error; }
          toast.success(`Registered with ID ${row.school_code}`);
          qc.invalidateQueries({ queryKey: ["registry"] });
        }} />
      </Panel>
      <Input placeholder="Search by name, ID or location" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid gap-4 md:grid-cols-3">
        {(["school", "academy", "club"] as const).map((t) => (
          <Panel key={t} title={`${t[0]!.toUpperCase() + t.slice(1)}s registry`}>
            <ul className="space-y-2">
              {list.filter((s) => s.school_type === t).map((s) => (
                <li key={s.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-primary">{s.school_code}</p>
                  {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
                  {s.self_registered && <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Self-registered</span>}
                </li>
              ))}
              {!list.some((s) => s.school_type === t) && <li className="text-sm text-muted-foreground">None yet.</li>}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}

/* ---------- Step 2: Athletes ---------- */
function AthletesStep({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data } = useRegistry();
  const [q, setQ] = useState("");
  const fields: Field[] = [
    { name: "first_name", label: "First name", required: true },
    { name: "surname", label: "Surname", required: true },
    { name: "sport", label: "Sport" },
    { name: "date_of_birth", label: "Date of birth", type: "date" },
    { name: "gender", label: "Gender", type: "select", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }] },
    { name: "phone", label: "Phone" },
    { name: "athlete_number", label: "Athlete number" },
    { name: "school_id", label: "School / academy / club (leave empty if independent)", type: "select",
      options: (data?.schools ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.school_type})` })) },
  ];
  const list = (data?.athletes ?? []).filter((a) =>
    `${a.first_name} ${a.surname} ${a.athlete_code} ${a.sport ?? ""} ${a.schools?.name ?? "independent"}`.toLowerCase().includes(q.toLowerCase()));

  async function saveNumber(id: string, value: string) {
    const { error } = await supabase.from("athletes").update({ athlete_number: value || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Athlete number saved"); qc.invalidateQueries({ queryKey: ["registry"] }); }
  }

  return (
    <>
      <Panel title="Register an athlete">
        <SimpleForm fields={fields} submitLabel="Register athlete" onSubmit={async (v) => {
          const { data: row, error } = await supabase.from("athletes").insert({ ...(clean(v) as { first_name: string; surname: string }), created_by: userId }).select("athlete_code").single();
          if (error) { toast.error(error.message); throw error; }
          toast.success(`Athlete registered with ID ${row.athlete_code}`);
          qc.invalidateQueries({ queryKey: ["registry"] });
        }} />
      </Panel>
      <Panel title="Athletes">
        <Input className="mb-3" placeholder="Search by name, ID, school or sport" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Sport</th><th className="p-2">School</th><th className="p-2">Athlete no.</th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2 text-primary">{a.athlete_code}</td>
                  <td className="p-2 font-medium">{a.first_name} {a.surname}</td>
                  <td className="p-2">{a.sport ?? "—"}</td>
                  <td className="p-2">{a.schools?.name ?? "Independent"}</td>
                  <td className="p-2">
                    <Input defaultValue={a.athlete_number ?? ""} className="h-8 w-28" onBlur={(e) => e.target.value !== (a.athlete_number ?? "") && saveNumber(a.id, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="p-2 text-sm text-muted-foreground">No athletes found.</p>}
        </div>
      </Panel>
    </>
  );
}

/* ---------- Step 3: Open a case ---------- */
function OpenCaseStep({ userId, onOpened }: { userId: string; onOpened: () => void }) {
  const qc = useQueryClient();
  const { data } = useRegistry();
  const [q, setQ] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const matches = (data?.athletes ?? []).filter((a) => `${a.first_name} ${a.surname} ${a.athlete_code}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const selected = data?.athletes.find((a) => a.id === athleteId);
  const fields: Field[] = [
    { name: "body_region", label: "Body region", required: true },
    { name: "mechanism", label: "Mechanism of injury" },
    { name: "injury_date", label: "Date of injury", type: "date" },
    { name: "pain_score", label: "Pain score (0-10)", type: "number" },
    { name: "sport_context", label: "Sport context (training, match…)" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  return (
    <Panel title="Open a new injury case">
      <Input placeholder="Search athlete by name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && !selected && (
        <ul className="mt-2 space-y-1">
          {matches.map((a) => (
            <li key={a.id}><Button variant="outline" className="w-full justify-start" onClick={() => setAthleteId(a.id)}>{a.first_name} {a.surname} · {a.athlete_code}</Button></li>
          ))}
          {!matches.length && <li className="text-sm text-muted-foreground">No athlete found — register them in step 2.</li>}
        </ul>
      )}
      {selected && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-secondary p-3 text-sm">
            <span><b>{selected.first_name} {selected.surname}</b> · {selected.athlete_code}</span>
            <Button size="sm" variant="outline" onClick={() => setAthleteId("")}>Change</Button>
          </div>
          <SimpleForm fields={fields} submitLabel="Open case" onSubmit={async (v) => {
            const { data: row, error } = await supabase.from("injuries")
              .insert({ ...(clean(v, ["pain_score"]) as { body_region: string }), athlete_id: selected.id, created_by: userId })
              .select("injury_code").single();
            if (error) { toast.error(error.message); throw error; }
            toast.success(`Case ${row.injury_code} opened`);
            qc.invalidateQueries({ queryKey: ["cases"] });
            onOpened();
          }} />
        </div>
      )}
    </Panel>
  );
}

/* ---------- Step 4: Manage a case ---------- */
type Sub = "assessment" | "rehab" | "exercises" | "followup" | "recovery" | "referrals" | "documents" | "record";
const SUBS: { v: Sub; l: string }[] = [
  { v: "assessment", l: "Assessment" }, { v: "rehab", l: "Rehab plan" }, { v: "exercises", l: "Exercises" },
  { v: "followup", l: "Follow-up review" }, { v: "recovery", l: "Recovery status" }, { v: "referrals", l: "Referrals & appointments" },
  { v: "documents", l: "Documents" }, { v: "record", l: "Full record" },
];

function ManageStep({ userId }: { userId: string }) {
  const [q, setQ] = useState("");
  const [caseId, setCaseId] = useState("");
  const [sub, setSub] = useState<Sub>("assessment");
  const { data: cases } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("injuries")
        .select("*, athletes(id, first_name, surname, athlete_code, sport, school_id, schools(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const filtered = useMemo(() => (cases ?? []).filter((c) =>
    `${c.injury_code} ${c.body_region} ${c.status} ${c.athletes?.first_name} ${c.athletes?.surname} ${c.athletes?.athlete_code} ${c.athletes?.schools?.name ?? ""}`
      .toLowerCase().includes(q.toLowerCase())), [cases, q]);
  const current = cases?.find((c) => c.id === caseId);

  if (!current) {
    return (
      <Panel title="Search a case">
        <Input placeholder="Search by case ID, athlete name/ID, body region, school or status" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-4 space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button onClick={() => { setCaseId(c.id); setSub("assessment"); }} className="w-full rounded-lg border p-3 text-left text-sm transition-colors hover:border-primary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-primary">{c.injury_code}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.status}</span>
                </div>
                <p className="text-foreground">{c.athletes?.first_name} {c.athletes?.surname} · {c.body_region}</p>
                <p className="text-xs text-muted-foreground">{c.athletes?.athlete_code} · {c.athletes?.schools?.name ?? "Independent"}</p>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="text-sm text-muted-foreground">No cases found.</li>}
        </ul>
      </Panel>
    );
  }

  const ctx = { userId, injuryId: current.id, athleteId: current.athlete_id };
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl bg-brand-gradient p-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="text-sm opacity-80">{current.injury_code} · {current.status}</p>
          <p className="text-lg font-bold">{current.athletes?.first_name} {current.athletes?.surname} — {current.body_region}</p>
        </div>
        <Button variant="secondary" onClick={() => setCaseId("")}>Choose another case</Button>
      </div>
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:hidden">
        {SUBS.map((s) => <Button key={s.v} size="sm" variant={sub === s.v ? "default" : "outline"} onClick={() => setSub(s.v)}>{s.l}</Button>)}
      </nav>
      {sub === "assessment" && <AssessmentSub {...ctx} />}
      {sub === "rehab" && <RehabSub {...ctx} />}
      {sub === "exercises" && <ExercisesSub {...ctx} />}
      {sub === "followup" && <FollowUpSub {...ctx} />}
      {sub === "recovery" && <RecoverySub {...ctx} />}
      {sub === "referrals" && <ReferralsSub {...ctx} />}
      {sub === "documents" && <DocumentsSub {...ctx} />}
      {sub === "record" && <RecordSub {...ctx} schoolId={current.athletes?.school_id ?? null} caseCode={current.injury_code} />}
    </div>
  );
}

type Ctx = { userId: string; injuryId: string; athleteId: string };

function useCaseRecord(injuryId: string) {
  return useQuery({
    queryKey: ["case-record", injuryId],
    queryFn: async () => {
      const by = <T extends string>(t: T) => supabase.from(t as "assessments").select("*").eq("injury_id", injuryId).order("created_at");
      const [inj, asm, rhb, ex, fu, rec, ref, apt, docs, notes] = await Promise.all([
        supabase.from("injuries").select("*, athletes(*, schools(name, school_code))").eq("id", injuryId).single(),
        by("assessments"), supabase.from("rehabilitation_plans").select("*").eq("injury_id", injuryId).order("created_at"),
        supabase.from("exercises").select("*").eq("injury_id", injuryId).order("created_at"),
        supabase.from("follow_ups").select("*").eq("injury_id", injuryId).order("review_date"),
        supabase.from("recovery_updates").select("*").eq("injury_id", injuryId).order("created_at"),
        supabase.from("referrals").select("*").eq("injury_id", injuryId).order("created_at"),
        supabase.from("appointments").select("*").eq("injury_id", injuryId).order("scheduled_at"),
        supabase.from("documents").select("*").eq("injury_id", injuryId).order("created_at"),
        supabase.from("clinical_notes").select("*").eq("injury_id", injuryId).order("created_at"),
      ]);
      return {
        injury: inj.data, assessments: asm.data ?? [], plans: rhb.data ?? [], exercises: ex.data ?? [], followUps: fu.data ?? [],
        recovery: rec.data ?? [], referrals: ref.data ?? [], appointments: apt.data ?? [], documents: docs.data ?? [], notes: notes.data ?? [],
      };
    },
  });
}

function useSaver(injuryId: string) {
  const qc = useQueryClient();
  return async (table: string, row: Record<string, unknown>, msg: string) => {
    const { error } = await supabase.from(table as "follow_ups").insert(row as never);
    if (error) { toast.error(error.message); throw error; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["case-record", injuryId] });
    qc.invalidateQueries({ queryKey: ["cases"] });
  };
}

function History({ items, render }: { items: Record<string, unknown>[]; render: (i: any) => ReactNode }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing saved yet.</p>;
  return <ul className="space-y-2">{items.map((i) => <li key={i["id"] as string} className="rounded-lg border p-3 text-sm">{render(i)}</li>)}</ul>;
}

const ASM_FIELDS: Field[] = [
  { name: "assessment_type", label: "Assessment type", type: "select", options: ["Initial", "Re-assessment", "Return to play", "Pre-season screening"].map((v) => ({ value: v, label: v })) },
  { name: "assessment_date", label: "Date", type: "date" },
  ...[
    ["presenting_complaint", "Presenting complaint"], ["history", "History"], ["mechanism", "Mechanism"], ["symptoms", "Symptoms"],
    ["pain", "Pain"], ["observation", "Observation"], ["range_of_motion", "Range of motion"], ["strength", "Strength"],
    ["balance", "Balance"], ["functional_tests", "Functional tests"], ["sport_specific_findings", "Sport-specific findings"],
    ["red_flags", "Red flags"], ["clinical_impression", "Clinical impression"], ["plan", "Plan"], ["referral_recommendation", "Referral recommendation"],
  ].map(([name, label]) => ({ name: name!, label: label!, type: "textarea" as const })),
  { name: "follow_up_date", label: "Follow-up date", type: "date" },
];

function AssessmentSub({ userId, injuryId, athleteId }: Ctx) {
  const save = useSaver(injuryId);
  const { data } = useCaseRecord(injuryId);
  return (
    <Panel title="Assessment template">
      <SimpleForm fields={ASM_FIELDS} submitLabel="Save assessment" onSubmit={(v) =>
        save("assessments", { ...clean(v), injury_id: injuryId, athlete_id: athleteId, created_by: userId }, "Assessment saved")} />
      <h3 className="mb-2 mt-6 font-semibold">Saved assessments</h3>
      <History items={data?.assessments ?? []} render={(a) => <><b className="text-primary">{a.assessment_code}</b> · {a.assessment_type ?? "Assessment"} · {a.assessment_date}<p className="text-muted-foreground">{a.clinical_impression}</p></>} />
    </Panel>
  );
}

function RehabSub({ userId, injuryId, athleteId }: Ctx) {
  const save = useSaver(injuryId);
  const { data } = useCaseRecord(injuryId);
  return (
    <Panel title="Rehabilitation plan">
      <SimpleForm submitLabel="Save plan" fields={[
        { name: "phase", label: "Phase", type: "select", options: ["Acute", "Sub-acute", "Strengthening", "Return to sport", "Maintenance"].map((v) => ({ value: v, label: v })) },
        { name: "start_date", label: "Start date", type: "date" },
        { name: "target_return_date", label: "Target return date", type: "date" },
        { name: "goals", label: "Goals", type: "textarea", required: true },
        { name: "notes", label: "Notes", type: "textarea" },
      ]} onSubmit={(v) => save("rehabilitation_plans", { ...clean(v), injury_id: injuryId, athlete_id: athleteId, created_by: userId }, "Rehab plan saved")} />
      <h3 className="mb-2 mt-6 font-semibold">Plans</h3>
      <History items={data?.plans ?? []} render={(p) => <><b className="text-primary">{p.plan_code}</b> · {p.phase ?? ""} · target {p.target_return_date ?? "—"}<p>{p.goals}</p></>} />
    </Panel>
  );
}

function ExercisesSub({ userId, injuryId, athleteId }: Ctx) {
  const save = useSaver(injuryId);
  const { data } = useCaseRecord(injuryId);
  return (
    <Panel title="Exercises">
      <SimpleForm submitLabel="Add exercise" fields={[
        { name: "name", label: "Exercise", required: true },
        { name: "plan_id", label: "Rehab plan", type: "select", options: (data?.plans ?? []).map((p) => ({ value: p.id, label: p.plan_code })) },
        { name: "sets", label: "Sets" },
        { name: "reps", label: "Reps / duration" },
        { name: "frequency", label: "Frequency" },
        { name: "instructions", label: "Instructions", type: "textarea" },
      ]} onSubmit={(v) => save("exercises", { ...clean(v, ["sets"]), injury_id: injuryId, athlete_id: athleteId, created_by: userId }, "Exercise added")} />
      <h3 className="mb-2 mt-6 font-semibold">Assigned exercises</h3>
      <History items={data?.exercises ?? []} render={(e) => <><b>{e.name}</b> · {e.sets ?? "—"} sets × {e.reps ?? "—"} · {e.frequency ?? ""}<p className="text-muted-foreground">{e.instructions}</p></>} />
    </Panel>
  );
}

function FollowUpSub({ userId, injuryId, athleteId }: Ctx) {
  const save = useSaver(injuryId);
  const { data } = useCaseRecord(injuryId);
  return (
    <Panel title="Follow-up review">
      <SimpleForm submitLabel="Save review" fields={[
        { name: "review_date", label: "Review date", type: "date", required: true },
        { name: "pain_score", label: "Pain score (0-10)", type: "number" },
        { name: "progress", label: "Progress", type: "textarea" },
        { name: "findings", label: "Findings", type: "textarea" },
        { name: "next_steps", label: "Next steps", type: "textarea" },
      ]} onSubmit={(v) => save("follow_ups", { ...clean(v, ["pain_score"]), injury_id: injuryId, athlete_id: athleteId, created_by: userId }, "Follow-up saved")} />
      <h3 className="mb-2 mt-6 font-semibold">Reviews</h3>
      <History items={data?.followUps ?? []} render={(f) => <><b>{f.review_date}</b> · pain {f.pain_score ?? "—"}/10<p>{f.progress}</p></>} />
    </Panel>
  );
}

const RECOVERY = ["new", "assessed", "in rehab", "modified training", "return to play", "recovered", "referred"];

function RecoverySub({ userId, injuryId, athleteId }: Ctx) {
  const save = useSaver(injuryId);
  const { data } = useCaseRecord(injuryId);
  return (
    <Panel title="Recovery status">
      <SimpleForm submitLabel="Update status" fields={[
        { name: "status", label: "Status", type: "select", required: true, options: RECOVERY.map((v) => ({ value: v, label: v })) },
        { name: "notes", label: "Notes", type: "textarea" },
      ]} onSubmit={async (v) => {
        await save("recovery_updates", { ...clean(v), injury_id: injuryId, athlete_id: athleteId, created_by: userId }, "Status updated");
        await supabase.from("injuries").update({ status: v["status"]! }).eq("id", injuryId);
      }} />
      <h3 className="mb-2 mt-6 font-semibold">Status history</h3>
      <History items={data?.recovery ?? []} render={(r) => <><b className="text-primary">{r.status}</b> · {new Date(r.created_at).toLocaleDateString()}<p>{r.notes}</p></>} />
    </Panel>
  );
}

function ReferralsSub({ userId, injuryId, athleteId }: Ctx) {
  const save = useSaver(injuryId);
  const { data } = useCaseRecord(injuryId);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Referrals">
        <SimpleForm submitLabel="Add referral" fields={[
          { name: "referred_to", label: "Referred to", required: true, full: true },
          { name: "reason", label: "Reason", type: "textarea" },
        ]} onSubmit={(v) => save("referrals", { ...clean(v), injury_id: injuryId, athlete_id: athleteId, created_by: userId }, "Referral added")} />
        <div className="mt-4"><History items={data?.referrals ?? []} render={(r) => <><b className="text-primary">{r.referral_code}</b> · {r.referred_to} · {r.status}<p>{r.reason}</p></>} /></div>
      </Panel>
      <Panel title="Appointments">
        <SimpleForm submitLabel="Schedule" fields={[
          { name: "scheduled_at", label: "Date & time", type: "datetime-local", required: true, full: true },
          { name: "location", label: "Location" },
          { name: "purpose", label: "Purpose" },
        ]} onSubmit={(v) => save("appointments", { ...clean(v), scheduled_at: new Date(v["scheduled_at"]!).toISOString(), injury_id: injuryId, athlete_id: athleteId, created_by: userId }, "Appointment scheduled")} />
        <div className="mt-4"><History items={data?.appointments ?? []} render={(a) => <><b className="text-primary">{a.appointment_code}</b> · {new Date(a.scheduled_at).toLocaleString()}<p>{a.purpose} {a.location && `@ ${a.location}`}</p></>} /></div>
      </Panel>
    </div>
  );
}

function DocumentsSub({ userId, injuryId, athleteId }: Ctx) {
  const qc = useQueryClient();
  const { data } = useCaseRecord(injuryId);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return toast.error("Choose a PDF first.");
    if (file.type !== "application/pdf") return toast.error("Only PDF files are allowed.");
    setBusy(true);
    const path = `${athleteId}/${injuryId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("case-documents").upload(path, file, { contentType: "application/pdf" });
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase.from("documents").insert({ injury_id: injuryId, athlete_id: athleteId, title: title || file.name, storage_path: path, file_size: file.size, created_by: userId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    setFile(null); setTitle("");
    qc.invalidateQueries({ queryKey: ["case-record", injuryId] });
  }

  async function open(path: string) {
    const { data: s, error } = await supabase.storage.from("case-documents").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(s.signedUrl, "_blank");
  }

  return (
    <Panel title="Documents (PDF)">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload PDF"}</Button>
      </div>
      <div className="mt-4">
        <History items={data?.documents ?? []} render={(d) => (
          <div className="flex items-center justify-between gap-2">
            <span><b>{d.title}</b> · {new Date(d.created_at).toLocaleDateString()}</span>
            <Button size="sm" variant="outline" onClick={() => open(d.storage_path)}>Open</Button>
          </div>
        )} />
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  return <p className="text-sm"><span className="font-semibold text-muted-foreground">{label}: </span>{String(value)}</p>;
}

function RecordSub({ userId, injuryId, athleteId, schoolId, caseCode }: Ctx & { schoolId: string | null; caseCode: string }) {
  const { data } = useCaseRecord(injuryId);
  const [showMsg, setShowMsg] = useState(false);
  if (!data?.injury) return <p className="text-sm text-muted-foreground">Loading record…</p>;
  const { injury } = data;
  const a = injury.athletes;
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="break-inside-avoid border-t pt-3"><h3 className="mb-2 font-bold text-primary">{title}</h3>{children}</div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row print:hidden">
        <Button onClick={() => window.print()}>Export / print PDF summary</Button>
        <Button variant="outline" onClick={() => setShowMsg((s) => !s)}>Send communication</Button>
      </div>
      {showMsg && <div className="print:hidden"><Compose userId={userId} athleteId={athleteId} schoolId={schoolId} defaultSubject={`Update on case ${caseCode}`} /></div>}
      <article className="space-y-4 rounded-2xl border bg-card p-6 print:border-0 print:p-0">
        <header className="flex items-center gap-3">
          <img src={logo.url} alt="VITO Physio" className="h-14 w-14" />
          <div>
            <h2 className="text-xl font-extrabold text-primary">VITO Physio — Case summary</h2>
            <p className="text-sm text-muted-foreground">{injury.injury_code} · printed {new Date().toLocaleDateString()}</p>
          </div>
        </header>
        <Section title="Athlete">
          <Row label="Name" value={`${a?.first_name} ${a?.surname}`} /><Row label="Athlete ID" value={a?.athlete_code} />
          <Row label="Athlete no." value={a?.athlete_number} /><Row label="Sport" value={a?.sport} />
          <Row label="School" value={a?.schools?.name ?? "Independent"} /><Row label="Date of birth" value={a?.date_of_birth} />
        </Section>
        <Section title="Injury">
          <Row label="Body region" value={injury.body_region} /><Row label="Mechanism" value={injury.mechanism} />
          <Row label="Date" value={injury.injury_date} /><Row label="Pain" value={injury.pain_score != null ? `${injury.pain_score}/10` : null} />
          <Row label="Sport context" value={injury.sport_context} /><Row label="Status" value={injury.status} /><Row label="Notes" value={injury.notes} />
        </Section>
        <Section title="Assessments">
          {data.assessments.map((x) => (
            <div key={x.id} className="mb-3">
              <p className="font-semibold">{x.assessment_code} · {x.assessment_type} · {x.assessment_date}</p>
              {ASM_FIELDS.slice(2).map((f) => <Row key={f.name} label={f.label} value={(x as Record<string, unknown>)[f.name]} />)}
            </div>
          ))}
          {!data.assessments.length && <p className="text-sm text-muted-foreground">None</p>}
        </Section>
        <Section title="Rehabilitation plans">
          {data.plans.map((p) => <div key={p.id} className="mb-2"><p className="font-semibold">{p.plan_code} · {p.phase}</p><Row label="Goals" value={p.goals} /><Row label="Target return" value={p.target_return_date} /><Row label="Notes" value={p.notes} /></div>)}
          {!data.plans.length && <p className="text-sm text-muted-foreground">None</p>}
        </Section>
        <Section title="Exercises">
          {data.exercises.map((e) => <p key={e.id} className="text-sm">• <b>{e.name}</b> — {e.sets ?? "—"} × {e.reps ?? "—"}, {e.frequency ?? ""} {e.instructions && `(${e.instructions})`}</p>)}
          {!data.exercises.length && <p className="text-sm text-muted-foreground">None</p>}
        </Section>
        <Section title="Follow-up reviews">
          {data.followUps.map((f) => <div key={f.id} className="mb-2"><p className="font-semibold">{f.review_date} · pain {f.pain_score ?? "—"}/10</p><Row label="Progress" value={f.progress} /><Row label="Findings" value={f.findings} /><Row label="Next steps" value={f.next_steps} /></div>)}
          {!data.followUps.length && <p className="text-sm text-muted-foreground">None</p>}
        </Section>
        <Section title="Recovery history">
          {data.recovery.map((r) => <p key={r.id} className="text-sm">• {new Date(r.created_at).toLocaleDateString()} — <b>{r.status}</b> {r.notes && `: ${r.notes}`}</p>)}
          {!data.recovery.length && <p className="text-sm text-muted-foreground">None</p>}
        </Section>
        <Section title="Referrals & appointments">
          {data.referrals.map((r) => <p key={r.id} className="text-sm">• {r.referral_code} → {r.referred_to} ({r.status}) {r.reason}</p>)}
          {data.appointments.map((x) => <p key={x.id} className="text-sm">• {x.appointment_code} — {new Date(x.scheduled_at).toLocaleString()} {x.purpose}</p>)}
          {!data.referrals.length && !data.appointments.length && <p className="text-sm text-muted-foreground">None</p>}
        </Section>
        <Section title="Documents on file">
          {data.documents.map((d) => <p key={d.id} className="text-sm">• {d.title}</p>)}
          {!data.documents.length && <p className="text-sm text-muted-foreground">None</p>}
        </Section>
      </article>
    </div>
  );
}

