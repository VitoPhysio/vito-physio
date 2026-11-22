import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  FileText,
  HeartPulse,
  Inbox,
  MessageSquare,
  Plus,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhotoAvatar } from "@/components/vito/Photo";
import { Inbox as WorkspaceInbox } from "@/components/vito/Communications";
import { CareRequests } from "@/components/vito/CareRequests";
import { contactClinician, reportInjury } from "@/lib/athlete.functions";
import type { CareRequestTarget } from "@/lib/care-requests";
import { STAGE_LABEL, stageProgress, useHealth, useViewer } from "./data";

type Form = { kind: "report" } | { kind: "contact"; target: CareRequestTarget; request?: string };
type Health = NonNullable<ReturnType<typeof useHealth>["data"]>;

const fmt = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "Not scheduled";

/**
 * Athlete care workspace: one hero with status, quick actions, and tabbed sections
 * (Overview, Recovery, Schedule, Requests, Records). Everything reads the athlete's own
 * linked records; requests go to the VITO clinical team or the athlete's institution.
 */
export function AthleteHome({ user }: { user: User }) {
  const viewer = useViewer(user);
  const health = useHealth(user.id);
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [tab, setTab] = useState("overview");
  const h = health.data;
  const v = viewer.data;
  const athlete = h?.athletes[0];
  const schoolName = athlete?.schools?.name ?? null;
  const active = h?.active ?? [];

  async function openThread(other: string) {
    const { data, error } = await supabase.rpc("create_workspace_conversation", { _other_user: other });
    if (error || !data) return void toast.error(error?.message ?? "Could not open the conversation");
    void navigate({ to: "/messages", search: { conversation: data, box: "workspace" } });
  }

  const status = health.isLoading
    ? "Loading your care record…"
    : !h?.linked
      ? "Link your athlete record to see your care"
      : active[0]
        ? `Recovering · ${active[0].body_region} (${STAGE_LABEL[active[0].status] ?? active[0].status})`
        : "All clear — no active injuries";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-3 sm:px-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-primary-foreground shadow-glow sm:p-7">
        <div aria-hidden="true" className="absolute -right-16 -top-16 size-56 rounded-full bg-background/10" />
        <div aria-hidden="true" className="absolute -bottom-20 right-24 size-40 rounded-full bg-background/10" />
        <div className="relative flex flex-wrap items-center gap-4">
          <PhotoAvatar path={v?.avatar ?? athlete?.photo_path} name={v?.name} className="size-16 ring-4 ring-background/25" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">Athlete workspace</p>
            <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
              Hi, {v?.firstName || "athlete"}
            </h1>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-90 sm:text-sm">
              {athlete?.athlete_code && <span>{athlete.athlete_code}</span>}
              {athlete?.sport && <span>· {athlete.sport}</span>}
              {schoolName && <span>· {schoolName}</span>}
            </p>
          </div>
          <span className="rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold backdrop-blur sm:text-sm">
            {status}
          </span>
        </div>
      </section>

      {health.isError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border-l-4 border-destructive bg-card p-4">
          <p className="text-sm">Your care record could not be loaded.</p>
          <Button variant="outline" size="sm" onClick={() => health.refetch()}>Retry</Button>
        </div>
      )}

      {!health.isLoading && !h?.linked && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Connect your athlete ID to see injuries, rehabilitation and appointments.</p>
          <Button asChild size="sm"><Link to="/link-account">Link athlete record</Link></Button>
        </section>
      )}

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ActionTile icon={Plus} title="Report an injury" detail="Start a new case" onClick={() => setForm({ kind: "report" })} primary />
        <ActionTile icon={CalendarDays} title="Request care" detail="Appointment or consultation" onClick={() => setForm({ kind: "contact", target: "clinic", request: "appointment" })} />
        <ActionTile icon={MessageSquare} title="Message my team" detail={schoolName ? `VITO or ${schoolName}` : "VITO clinical team"} onClick={() => setForm({ kind: "contact", target: "clinic", request: "message" })} />
        <ActionTile icon={Inbox} title="Workspace inbox" detail="Replies and answers" onClick={() => void navigate({ to: "/messages", search: { box: "workspace" } })} />
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border bg-card p-1 [scrollbar-width:none]">
          {(
            [
              ["overview", "Overview"],
              ["recovery", "Recovery"],
              ["schedule", "Schedule"],
              ["requests", "Requests"],
              ["records", "Records"],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="shrink-0 rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <Card title="Recovery progress" icon={Activity} action={active.length ? { label: "Details", onClick: () => setTab("recovery") } : undefined}>
                {active.length ? (
                  <ul className="space-y-4">
                    {active.slice(0, 3).map((i) => (
                      <li key={i.id}>
                        <div className="mb-1.5 flex justify-between gap-2 text-sm">
                          <span className="font-semibold">{i.body_region}</span>
                          <span className="text-xs font-medium text-primary">{STAGE_LABEL[i.status] ?? i.status}</span>
                        </div>
                        <Progress value={stageProgress(i.status)} />
                        <p className="mt-1 text-xs text-muted-foreground">{i.injury_code} · reported {fmt(i.injury_date ?? i.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty icon={HeartPulse} text="No active injuries. Train smart and report anything early." />
                )}
              </Card>
              <Card title="My rehab exercises" icon={Dumbbell} action={h?.exercises.length ? { label: "All", onClick: () => setTab("recovery") } : undefined}>
                {h?.exercises.length ? (
                  <ul className="divide-y">
                    {h.exercises.slice(0, 4).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="font-medium">{e.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {e.sets ?? "—"}×{e.reps || "—"} {e.frequency ? `· ${e.frequency}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty icon={Dumbbell} text="No exercises prescribed yet." />
                )}
              </Card>
            </div>
            <div className="space-y-4">
              <Card title="Next appointment" icon={CalendarDays} action={{ label: "Schedule", onClick: () => setTab("schedule") }}>
                {h?.upcoming[0] ? (
                  <div>
                    <p className="text-2xl font-black tracking-tight">{fmt(h.upcoming[0].scheduled_at)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(h.upcoming[0].scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {h.upcoming[0].location ? ` · ${h.upcoming[0].location}` : ""}
                    </p>
                    <p className="mt-1 text-sm">{h.upcoming[0].purpose || "Clinical appointment"}</p>
                  </div>
                ) : (
                  <Empty icon={CalendarDays} text="Nothing booked." />
                )}
              </Card>
              <Card title="My care team" icon={Stethoscope}>
                {h?.careTeam.length ? (
                  <ul className="space-y-2">
                    {h.careTeam.map((c) => (
                      <li key={c.id} className="flex items-center gap-3">
                        <PhotoAvatar name={c.name} className="size-9" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                        <Button size="sm" variant="outline" onClick={() => void openThread(c.id)}>Message</Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty icon={Stethoscope} text="Your VITO clinicians appear here once they work on your case." />
                )}
              </Card>
              <Card title="My institution" icon={Building2}>
                {schoolName ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{schoolName}</p>
                    <Button size="sm" variant="outline" onClick={() => setForm({ kind: "contact", target: "institution", request: "message" })}>
                      Contact
                    </Button>
                  </div>
                ) : (
                  <Empty icon={Building2} text="Not registered with a school, club or academy yet." />
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recovery" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="My injuries" icon={HeartPulse}><InjuryList h={h} /></Card>
          <Card title="Rehabilitation" icon={Dumbbell}><RehabList h={h} /></Card>
          <Card title="Assessments" icon={ShieldCheck}>
            {h?.assessments.length ? (
              <ul className="divide-y">
                {h.assessments.map((a) => (
                  <li key={a.id} className="py-2.5 text-sm">
                    <p className="font-semibold">{a.assessment_type || "Injury assessment"} · {a.assessment_code}</p>
                    <p className="text-xs text-muted-foreground">Assessed {fmt(a.assessment_date)} · follow-up {fmt(a.follow_up_date)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={ShieldCheck} text="No assessment summaries yet." />
            )}
          </Card>
          <Card title="Care updates" icon={Activity}>
            {h?.timeline.length ? (
              <ol className="relative space-y-3 border-l pl-4">
                {h.timeline.slice(0, 10).map((t) => (
                  <li key={t.id} className="text-sm">
                    <span className="absolute -left-1 mt-1.5 size-2 rounded-full bg-accent" />
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{fmt(t.at)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty icon={Activity} text="No care updates yet." />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card title="Appointments & follow-ups" icon={CalendarDays} action={{ label: "Request appointment", onClick: () => setForm({ kind: "contact", target: "clinic", request: "appointment" }) }}>
            {h?.appointments.length || h?.dueFollowUps.length ? (
              <ul className="divide-y">
                {h?.appointments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
                    <DateBadge value={a.scheduled_at} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.purpose || "Clinical appointment"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {a.location ? ` · ${a.location}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{a.status}</span>
                  </li>
                ))}
                {h?.dueFollowUps.map((f, i) => (
                  <li key={`f${i}`} className="flex items-center gap-3 py-3 text-sm">
                    <DateBadge value={f.date} />
                    <p className="font-semibold">{f.source}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={CalendarDays} text="No appointments or follow-ups scheduled." />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4 space-y-5">
          <Card title="My requests" icon={MessageSquare} action={{ label: "New request", onClick: () => setForm({ kind: "contact", target: "clinic", request: "appointment" }) }}>
            <CareRequests userId={user.id} mode={{ as: "athlete" }} />
          </Card>
          <Card title="Workspace messages" icon={Inbox}>
            <WorkspaceInbox userId={user.id} />
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <Records h={h} name={athlete ? `${athlete.first_name} ${athlete.surname}` : (v?.name ?? "")} />
        </TabsContent>
      </Tabs>

      <RequestDialog form={form} onClose={() => setForm(null)} h={h} schoolName={schoolName} userId={user.id} />
    </div>
  );
}

function ActionTile({ icon: Icon, title, detail, onClick, primary }: { icon: LucideIcon; title: string; detail: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-28 flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${primary ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
    >
      <span className={`grid size-9 place-items-center rounded-xl ${primary ? "bg-background/20" : "bg-primary/10 text-primary"}`}>
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className={`block truncate text-xs ${primary ? "opacity-85" : "text-muted-foreground"}`}>{detail}</span>
      </span>
    </button>
  );
}

function Card({ title, icon: Icon, action, children }: { title: string; icon: LucideIcon; action?: { label: string; onClick: () => void } | undefined; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon aria-hidden="true" className="size-4 text-primary" /> {title}
        </h2>
        {action && (
          <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-primary" onClick={action.onClick}>
            {action.label} <ChevronRight aria-hidden="true" className="size-3.5" />
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-4 text-sm text-muted-foreground">
      <Icon aria-hidden="true" className="size-5 shrink-0 opacity-60" />
      <p>{text}</p>
    </div>
  );
}

function DateBadge({ value }: { value: string }) {
  const d = new Date(value);
  return (
    <span className="grid w-12 shrink-0 place-items-center rounded-xl bg-primary/10 py-1 text-primary">
      <span className="text-[10px] font-bold uppercase">{d.toLocaleDateString(undefined, { month: "short" })}</span>
      <span className="text-lg font-black leading-none">{d.getDate()}</span>
    </span>
  );
}

function InjuryList({ h }: { h: Health | undefined }) {
  if (!h?.injuries.length) return <Empty icon={HeartPulse} text="No injuries recorded." />;
  return (
    <ul className="space-y-4">
      {h.injuries.map((i) => (
        <li key={i.id} className="border-b pb-4 last:border-0 last:pb-0">
          <div className="flex justify-between gap-2 text-sm">
            <p className="font-semibold">{i.body_region} · {i.injury_code}</p>
            <span className="text-xs text-primary">{STAGE_LABEL[i.status] ?? i.status}</span>
          </div>
          <Progress value={stageProgress(i.status)} className="my-2" />
          <p className="text-xs text-muted-foreground">{fmt(i.injury_date)} · Pain {i.pain_score ?? "—"}/10</p>
          {i.mechanism && <p className="mt-1 text-sm">{i.mechanism}</p>}
          {h.recovery.filter((r) => r.injury_id === i.id).map((r) => (
            <p key={r.id} className="mt-1 text-xs text-muted-foreground">
              {fmt(r.created_at)} · {STAGE_LABEL[r.status] ?? r.status}{r.notes ? ` — ${r.notes}` : ""}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function RehabList({ h }: { h: Health | undefined }) {
  if (!h?.rehab.length && !h?.exercises.length) return <Empty icon={Dumbbell} text="No rehabilitation prescribed yet." />;
  return (
    <div className="space-y-4">
      {h.rehab.map((p) => (
        <article key={p.id} className="rounded-xl bg-muted/40 p-3 text-sm">
          <p className="font-semibold">{p.phase || "Rehabilitation plan"} · {p.plan_code}</p>
          {p.goals && <p className="mt-1">{p.goals}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Target return {fmt(p.target_return_date)}</p>
        </article>
      ))}
      <ul className="divide-y">
        {h.exercises.map((e) => (
          <li key={e.id} className="py-2.5 text-sm">
            <p className="font-medium">{e.name}</p>
            <p className="text-xs text-muted-foreground">{e.sets ?? "—"} sets · {e.reps || "—"} reps{e.frequency ? ` · ${e.frequency}` : ""}</p>
            {e.instructions && <p className="mt-1 text-xs">{e.instructions}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Records({ h, name }: { h: Health | undefined; name: string }) {
  const documents = useQuery({
    queryKey: ["athlete-documents", h?.athletes.map((a) => a.id).join(",")],
    enabled: !!h?.athletes.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, storage_path, created_at")
        .in("athlete_id", h?.athletes.map((a) => a.id) ?? []);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Health summary" icon={FileText} action={{ label: "Print", onClick: () => window.print() }}>
        <div className="athlete-print-summary space-y-2 text-sm">
          <p className="font-semibold">{name}</p>
          {h?.injuries.map((i) => (
            <p key={i.id}>{i.injury_code} · {i.body_region} · {STAGE_LABEL[i.status] ?? i.status} · {fmt(i.injury_date)}</p>
          ))}
          {h?.followUps.map((f) => (
            <div key={f.id}>
              <p className="font-medium">Review · {fmt(f.review_date)}</p>
              {f.progress && <p className="text-muted-foreground">{f.progress}</p>}
              {f.next_steps && <p className="text-muted-foreground">{f.next_steps}</p>}
            </div>
          ))}
          {!h?.injuries.length && <Empty icon={FileText} text="No history yet." />}
        </div>
      </Card>
      <Card title="Documents" icon={FileText}>
        {documents.isError && <p role="alert" className="text-sm text-destructive">Documents could not be loaded.</p>}
        <div className="flex flex-col gap-2">
          {documents.data?.map((d) => (
            <Button
              key={d.id}
              variant="outline"
              className="justify-start"
              onClick={async () => {
                const { data, error } = await supabase.storage.from("case-documents").createSignedUrl(d.storage_path, 60);
                if (error || !data) toast.error("Document could not be opened.");
                else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <FileText className="size-4" /> {d.title}
            </Button>
          ))}
        </div>
        {!documents.isLoading && !documents.data?.length && !documents.isError && <Empty icon={FileText} text="No documents available." />}
      </Card>
    </div>
  );
}

function RequestDialog({ form, onClose, h, schoolName, userId }: { form: Form | null; onClose: () => void; h: Health | undefined; schoolName: string | null; userId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<CareRequestTarget>("clinic");
  const [shownFor, setShownFor] = useState<Form | null>(null);
  if (form !== shownFor) {
    setShownFor(form);
    if (form?.kind === "contact") setTarget(form.target === "institution" && schoolName ? "institution" : "clinic");
  }
  const report = form?.kind === "report";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (report) {
        const id = String(f.get("athlete") ?? "");
        if (!id) throw new Error("Link your athlete record first.");
        const code = await reportInjury({
          data: {
            athlete_id: id,
            body_region: String(f.get("region")),
            mechanism: String(f.get("mechanism")),
            injury_date: String(f.get("date")) || undefined,
            pain_score: Number(f.get("pain")),
            notes: String(f.get("body")),
          },
        });
        toast.success(`Injury reported: ${code}`);
      } else {
        await contactClinician({
          data: {
            athlete_id: String(f.get("athlete")) || undefined,
            kind: String(f.get("kind")) as "message" | "appointment" | "consultation" | "follow_up",
            body: String(f.get("body")),
            target,
          },
        });
        toast.success(`Sent to ${target === "institution" ? schoolName : "the VITO clinical team"} — replies arrive in your Workspace inbox`);
      }
      qc.invalidateQueries({ queryKey: ["athlete-health", userId] });
      qc.invalidateQueries({ queryKey: ["care-requests"] });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={form !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{report ? "Report an injury" : "Contact my care team"}</DialogTitle>
        </DialogHeader>
        {form && (
          <form className="space-y-4" onSubmit={submit}>
            {!report && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Send to</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["clinic", "VITO clinical team", Stethoscope],
                    ["institution", schoolName ?? "My institution", Building2],
                  ] as const).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={value === "institution" && !schoolName}
                      onClick={() => setTarget(value)}
                      aria-pressed={target === value}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-colors disabled:opacity-50 ${target === value ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
                {!schoolName && <p className="text-xs text-muted-foreground">Join a school, club or academy to message it here.</p>}
              </fieldset>
            )}
            <div className="space-y-1">
              <Label htmlFor="athlete-record">Athlete record</Label>
              <select id="athlete-record" name="athlete" className="w-full rounded-md border bg-background p-2 text-sm" required={report || target === "institution"} defaultValue={h?.athletes[0]?.id ?? ""}>
                {!report && target === "clinic" && <option value="">General enquiry</option>}
                {h?.athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.first_name} {a.surname}</option>
                ))}
              </select>
            </div>
            {report ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="region">Body region</Label>
                  <Input id="region" name="region" required minLength={2} maxLength={120} placeholder="e.g. Right ankle" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="injury-date">Injury date</Label>
                  <Input id="injury-date" name="date" type="date" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pain">Pain (0–10)</Label>
                  <Input id="pain" name="pain" type="number" min={0} max={10} defaultValue={0} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="mechanism">What happened?</Label>
                  <Input id="mechanism" name="mechanism" maxLength={500} />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="request-kind">Request type</Label>
                <select id="request-kind" name="kind" defaultValue={form.kind === "contact" ? form.request : "message"} className="w-full rounded-md border bg-background p-2 text-sm">
                  <option value="message">Message</option>
                  <option value="appointment">Appointment request</option>
                  <option value="consultation">Consultation request</option>
                  <option value="follow_up">Follow-up request</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="message-body">{report ? "Additional details" : "Message"}</Label>
              <Textarea id="message-body" name="body" rows={4} required={!report} minLength={report ? undefined : 2} maxLength={report ? 1500 : 3700} />
            </div>
            <Button type="submit" className="w-full" disabled={busy || (report && !h?.linked)}>
              {busy ? "Sending…" : report ? "Register case" : "Send"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
