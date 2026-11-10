// @ts-nocheck -- uses tables missing from the generated database types
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleForm, selectClass } from "@/components/vito/SimpleForm";
import { WorkspaceMenus } from "@/components/vito/WorkspaceMenus";
import {
  EMPTY_FILTERS, INJURY_TYPES, MECHANISMS, MIN_SAMPLE, NOT_RECORDED, REGIONS, SEVERITIES, TIMELINESS,
  applyFilters, avg, buildInjuries, countBy, crossTab, daysBetween, histogram, incidencePer1000, intervalStats, median, overview,
  pct, periodKey, prolongedCutoff, pseudonymiser, recoveryDays, sampleNote, seasonal, timeSeries,
  type Dataset, type Filters, type Injury, type Period,
} from "@/lib/research-analytics";
import { download, printPdf, toCsv, toExcelXml, type Report, type Table } from "@/lib/research-export";

const all = <T,>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => Promise.resolve(p).then(({ data, error }) => { if (error) throw new Error(error.message); return data ?? []; });

const researchQuery = queryOptions({
  queryKey: ["research-dataset"],
  queryFn: async () => {
    const [injuries, athletes, assessments, rehab, followUps, recovery, exposures, thresholds] = await Promise.all([
      all(supabase.from("injuries").select("id, athlete_id, body_region, mechanism, injury_date, created_at, status, injury_type, severity, mechanism_category, onset_type, activity_context, is_recurrence, previous_injury_id, reported_at, resolved_at, days_lost")),
      all(supabase.from("athletes").select("id, sport, date_of_birth, competition_level, school_id, schools(name)")),
      all(supabase.from("assessments").select("injury_id, assessment_date, created_at")),
      all(supabase.from("rehabilitation_plans").select("injury_id, start_date, created_at")),
      all(supabase.from("follow_ups").select("injury_id, review_date")),
      all(supabase.from("recovery_updates").select("injury_id, status, created_at")),
      all(supabase.from("athlete_exposures").select("athlete_id, session_date, session_type, hours")),
      all(supabase.from("analytics_thresholds").select("key, label, days")),
    ]);
    const dataset: Dataset = {
      injuries,
      athletes: athletes.map((a) => ({ id: a.id, sport: a.sport, date_of_birth: a.date_of_birth, competition_level: a.competition_level, school_id: a.school_id, school_name: (a.schools as { name: string } | null)?.name ?? null })),
      assessments: assessments.map((r) => ({ injury_id: r.injury_id, date: r.assessment_date ?? r.created_at })),
      rehab: rehab.map((r) => ({ injury_id: r.injury_id, date: r.start_date ?? r.created_at })),
      followUps: followUps.map((r) => ({ injury_id: r.injury_id, date: r.review_date })),
      recovery: recovery.map((r) => ({ injury_id: r.injury_id, date: r.created_at, status: r.status })),
      exposures: exposures.map((e) => ({ ...e, hours: Number(e.hours) })),
    };
    return { dataset, thresholds };
  },
});

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({ meta: [{ title: "Research & Analytics — VITO Physio" }, { name: "description", content: "Sports injury surveillance, recovery outcomes and timeliness analytics from recorded VITO Physio cases." }, { property: "og:title", content: "Research & Analytics — VITO Physio" }, { property: "og:description", content: "Injury surveillance and research analytics for VITO Physio staff." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("is_vito_staff", { _user_id: context.user.id });
    if (!data) throw redirect({ to: "/dashboard" });
    const [sa, va] = await Promise.all([
      supabase.rpc("has_role", { _user_id: context.user.id, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: context.user.id, _role: "vito_admin" }),
    ]);
    return { researchAdmin: !!sa.data || !!va.data };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(researchQuery),
  component: ResearchPage,
});

type Section = "overview" | "distribution" | "temporal" | "sport" | "recurrence" | "recovery" | "timeliness" | "reports";
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)", "var(--accent)"];
const show = (v: number | null | undefined, unit = "") => (v == null ? "—" : `${v}${unit}`);

function ResearchPage() {
  const { researchAdmin } = Route.useRouteContext();
  const { data } = useSuspenseQuery(researchQuery);
  const [section, setSection] = useState<Section>("overview");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const base = useMemo(() => buildInjuries(data.dataset), [data.dataset]);
  const rows = useMemo(() => applyFilters(base, filters), [base, filters]);
  const thresholds = useMemo(() => new Map(data.thresholds.map((t) => [t.key, t])), [data.thresholds]);
  const options = useMemo(() => ({
    sport: [...new Set(base.map((r) => r.sport))].sort(), institution: [...new Set(base.map((r) => r.institution))].sort(),
    type: [...INJURY_TYPES, NOT_RECORDED], region: [...REGIONS, "Other / unclassified", NOT_RECORDED], severity: [...SEVERITIES, NOT_RECORDED], mechanism: [...MECHANISMS, NOT_RECORDED],
  }), [base]);
  const exposureHours = useMemo(() => {
    const ids = new Set(rows.map((r) => r.athleteId));
    return data.dataset.exposures.filter((e) => (!filters.from || e.session_date >= filters.from) && (!filters.to || e.session_date <= filters.to) && (filters.sport || filters.institution || filters.category ? ids.has(e.athlete_id) : true)).reduce((s, e) => s + e.hours, 0);
  }, [rows, filters, data.dataset.exposures]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div><h1 className="text-xl font-bold">Research & Analytics</h1><p className="text-sm opacity-90">Sports injury surveillance from recorded VITO Physio cases</p></div>
          <Button asChild variant="secondary" size="sm"><Link to="/dashboard"><ArrowLeft className="mr-1 size-4" />Dashboard</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-5">
        <WorkspaceMenus value={section} onSelect={(v) => setSection(v as Section)} menus={[
          { label: "Surveillance", items: [{ label: "Research overview", value: "overview" }, { label: "Injury distribution", value: "distribution" }, { label: "Temporal analysis", value: "temporal" }] },
          { label: "Athletes & outcomes", items: [{ label: "Sport & athlete analysis", value: "sport" }, { label: "Injury frequency & recurrence", value: "recurrence" }, { label: "Recovery outcomes", value: "recovery" }, { label: "Timeliness analysis", value: "timeliness" }] },
          { label: "Output", items: [{ label: "Reports & exports", value: "reports" }] },
        ]} />
        <FilterBar filters={filters} setFilters={setFilters} options={options} />
        <p className="text-xs text-muted-foreground">Showing {rows.length} of {base.length} recorded injuries. “{NOT_RECORDED}” means the field is empty on the record; nothing is estimated.</p>
        {section === "overview" && <OverviewSection rows={rows} />}
        {section === "distribution" && <DistributionSection rows={rows} />}
        {section === "temporal" && <TemporalSection rows={rows} />}
        {section === "sport" && <SportSection rows={rows} />}
        {section === "recurrence" && <RecurrenceSection rows={rows} exposureHours={exposureHours} admin={researchAdmin} athletes={data.dataset.athletes.length} />}
        {section === "recovery" && <RecoverySection rows={rows} />}
        {section === "timeliness" && <TimelinessSection rows={rows} thresholds={thresholds} admin={researchAdmin} />}
        {section === "reports" && <ReportsSection rows={rows} filters={filters} exposureHours={exposureHours} thresholds={thresholds} />}
      </main>
    </div>
  );
}

function FilterBar({ filters, setFilters, options }: { filters: Filters; setFilters: (f: Filters) => void; options: Record<string, string[]> }) {
  const set = (k: keyof Filters, v: string) => setFilters({ ...filters, [k]: v });
  const sel = (k: keyof Filters, label: string, values: string[], labels?: Record<string, string>) => (
    <label className="space-y-1 text-xs font-medium"><span>{label}</span>
      <select className={selectClass} value={filters[k]} onChange={(e) => set(k, e.target.value)}><option value="">All</option>{values.map((v) => <option key={v} value={v}>{labels?.[v] ?? v}</option>)}</select>
    </label>
  );
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="space-y-1 text-xs font-medium"><span>From</span><Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} /></label>
        <label className="space-y-1 text-xs font-medium"><span>To</span><Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} /></label>
        {sel("sport", "Sport", options.sport!)}
        {sel("type", "Injury type", options.type!)}
        {sel("region", "Anatomical location", options.region!)}
        {sel("severity", "Severity", options.severity!)}
        {sel("mechanism", "Mechanism", options.mechanism!)}
        {sel("category", "Athlete category", ["Team sport", "Individual sport", NOT_RECORDED])}
        {sel("institution", "Team / institution", options.institution!)}
        {sel("status", "Injury status", ["Awaiting assessment", "Active", "In rehabilitation", "Resolved"])}
        {sel("recurrence", "Recurrent vs first-time", ["recurrent", "first"], { recurrent: "Recurrent", first: "First-time" })}
        {sel("recovery", "Recovery status", ["resolved", "unresolved"], { resolved: "Recovered / resolved", unresolved: "Not yet recovered" })}
      </div>
      <div className="mt-3 flex justify-end"><Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all filters</Button></div>
    </section>
  );
}

function Card({ title, children, note }: { title: string; children: ReactNode; note?: string | null }) {
  return <section className="rounded-xl border bg-card p-4 shadow-sm"><h2 className="mb-3 text-base font-bold">{title}</h2>{note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}{children}</section>;
}
function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="rounded-xl border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}</div>;
}
function Empty({ rows }: { rows: Injury[] }) {
  const note = sampleNote(rows.length);
  return note ? <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{note}</p> : null;
}
function BarView({ data, height = 260 }: { data: { name: string; value: number }[]; height?: number }) {
  if (!data.some((d) => d.value)) return <p className="text-sm text-muted-foreground">No recorded data for this view.</p>;
  return <ResponsiveContainer width="100%" height={height}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Injuries" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>;
}
function PieView({ data }: { data: { name: string; value: number }[] }) {
  const d = data.filter((x) => x.value);
  if (!d.length) return <p className="text-sm text-muted-foreground">No recorded data for this view.</p>;
  return <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={d} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>{d.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>;
}
function DataTable({ t }: { t: Table }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{t.headers.map((h) => <th key={h} className="border-b p-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead><tbody>{t.rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className="p-2">{c ?? "—"}</td>)}</tr>)}</tbody></table>{t.note && <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>}</div>;
}
const distTable = (title: string, d: { name: string; value: number; share: number | null }[]): Table => ({ title, headers: ["Category", "Injuries", "% of filtered"], rows: d.map((x) => [x.name, x.value, x.share == null ? null : `${x.share}%`]) });

function OverviewSection({ rows }: { rows: Injury[] }) {
  const o = overview(rows);
  return <div className="space-y-4"><Empty rows={rows} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Total injuries recorded" value={o.total} /><Stat label="Athletes affected" value={o.athletes} />
      <Stat label="New (first-time) injuries" value={o.newCases} /><Stat label="Recurrent injuries" value={o.recurrent} />
      <Stat label="Active (not resolved)" value={o.active} /><Stat label="Resolved" value={o.resolved} />
      <Stat label="Acute onset" value={o.acute} hint={`Onset recorded on ${o.onsetRecorded} of ${o.total}`} /><Stat label="Gradual / chronic onset" value={o.chronic} hint={`Onset recorded on ${o.onsetRecorded} of ${o.total}`} />
      <Stat label="Average recovery duration" value={show(o.avgRecovery, " d")} hint={`${o.recoverySample} resolved case(s) with dates`} /><Stat label="Average time lost" value={show(o.avgDaysLost, " d")} hint={`${o.daysLostSample} case(s) with days lost recorded`} />
      <Stat label="Athletes in rehabilitation" value={new Set(rows.filter((r) => r.statusGroup === "In rehabilitation").map((r) => r.athleteId)).size} /><Stat label="Awaiting assessment" value={o.awaiting} />
      <Stat label="Recurrence rate" value={show(o.recurrenceRate, "%")} hint="Recurrent injuries ÷ all filtered injuries" />
    </div>
    <Card title="Status breakdown"><PieView data={countBy(rows, (r) => r.statusGroup)} /></Card>
  </div>;
}

function DistributionSection({ rows }: { rows: Injury[] }) {
  const views = [["Anatomical location", countBy(rows, (r) => r.region, [...REGIONS, "Other / unclassified", NOT_RECORDED])], ["Injury type", countBy(rows, (r) => r.type, [...INJURY_TYPES, NOT_RECORDED])], ["Mechanism of injury", countBy(rows, (r) => r.mechanism, [...MECHANISMS, NOT_RECORDED])], ["Severity", countBy(rows, (r) => r.severity, [...SEVERITIES, NOT_RECORDED])]] as const;
  const heat = crossTab(rows, (r) => r.region, (r) => r.severity);
  const max = Math.max(1, ...heat.rows.flatMap((a) => heat.cols.map((b) => heat.cell(a, b))));
  return <div className="space-y-4"><Empty rows={rows} />
    <div className="grid gap-4 lg:grid-cols-2">{views.map(([t, d]) => <Card key={t} title={t}>{t === "Severity" ? <PieView data={d} /> : <BarView data={d} />}<DataTable t={distTable(t, d.filter((x) => x.value))} /></Card>)}</div>
    <Card title="Heatmap — location × severity"><div className="overflow-x-auto"><table className="text-xs"><thead><tr><th className="p-1" />{heat.cols.map((c) => <th key={c} className="p-1 font-semibold">{c}</th>)}</tr></thead><tbody>{heat.rows.map((a) => <tr key={a}><th className="p-1 text-left font-medium">{a}</th>{heat.cols.map((b) => { const v = heat.cell(a, b); return <td key={b} className="h-8 w-16 text-center" style={{ background: `color-mix(in oklab, var(--chart-1) ${Math.round((v / max) * 85)}%, transparent)` }}>{v || ""}</td>; })}</tr>)}</tbody></table></div></Card>
  </div>;
}

const PERIODS: { v: Period; l: string }[] = [{ v: "day", l: "Daily" }, { v: "week", l: "Weekly" }, { v: "month", l: "Monthly" }, { v: "quarter", l: "Quarterly" }, { v: "half", l: "Half-yearly" }, { v: "year", l: "Annual" }];
function TemporalSection({ rows }: { rows: Injury[] }) {
  const [period, setPeriod] = useState<Period>("month");
  const series = timeSeries(rows, period);
  const peak = [...series].sort((a, b) => b.total - a.total)[0];
  const weeks = timeSeries(rows, "week").sort((a, b) => b.total - a.total)[0];
  const types = crossTab(rows, (r) => periodKey(r.date, period), (r) => r.type);
  const [cmp, setCmp] = useState({ a: "", b: "" });
  const keys = series.map((s) => s.period);
  const pick = (k: string) => rows.filter((r) => periodKey(r.date, period) === k);
  return <div className="space-y-4"><Empty rows={rows} />
    <div className="flex flex-wrap gap-2">{PERIODS.map((p) => <Button key={p.v} size="sm" variant={period === p.v ? "default" : "outline"} onClick={() => setPeriod(p.v)}>{p.l}</Button>)}<span className="self-center text-xs text-muted-foreground">Use the From/To filters for a custom range.</span></div>
    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Peak period" value={peak ? peak.period : "—"} hint={peak ? `${peak.total} injuries` : undefined} /><Stat label="Peak week" value={weeks ? weeks.period : "—"} hint={weeks ? `${weeks.total} injuries` : undefined} /><Stat label="Periods with injuries" value={series.length} /></div>
    <Card title="Injury trend — first-time vs recurrent">{series.length ? <ResponsiveContainer width="100%" height={280}><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line dataKey="total" name="All" stroke="var(--chart-1)" strokeWidth={2} /><Line dataKey="first" name="First-time" stroke="var(--chart-2)" /><Line dataKey="recurrent" name="Recurrent" stroke="var(--chart-4)" /></LineChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">No recorded injuries in range.</p>}</Card>
    <Card title="Seasonal pattern (all years, by calendar month)" note="Month of injury date (record date if injury date missing)."><BarView data={seasonal(rows)} /></Card>
    <Card title="Injury types by period"><DataTable t={{ title: "Types by period", headers: ["Period", ...types.cols], rows: types.rows.map((p) => [p, ...types.cols.map((c) => types.cell(p, c))]) }} /></Card>
    <Card title="Compare two periods"><div className="mb-3 grid gap-2 sm:grid-cols-2">{(["a", "b"] as const).map((k) => <select key={k} className={selectClass} value={cmp[k]} onChange={(e) => setCmp({ ...cmp, [k]: e.target.value })}><option value="">Choose period {k.toUpperCase()}</option>{keys.map((x) => <option key={x}>{x}</option>)}</select>)}</div>{cmp.a && cmp.b && <Compare a={[cmp.a, pick(cmp.a)]} b={[cmp.b, pick(cmp.b)]} />}</Card>
  </div>;
}

function Compare({ a, b }: { a: [string, Injury[]]; b: [string, Injury[]] }) {
  const line = (label: string, f: (r: Injury[]) => string | number) => [label, f(a[1]), f(b[1])];
  const ov = (r: Injury[]) => overview(r);
  const top = (r: Injury[], k: (x: Injury) => string) => countBy(r, k)[0]?.name ?? "—";
  return <DataTable t={{ title: "Comparison", headers: ["Measure", a[0], b[0]], rows: [
    line("Injuries", (r) => r.length), line("Athletes affected", (r) => ov(r).athletes), line("Recurrent", (r) => ov(r).recurrent), line("Recurrence rate", (r) => show(ov(r).recurrenceRate, "%")),
    line("Resolved", (r) => ov(r).resolved), line("Average recovery (days)", (r) => show(ov(r).avgRecovery)), line("Most common location", (r) => top(r, (x) => x.region)), line("Most common type", (r) => top(r, (x) => x.type)),
  ], note: a[1].length < MIN_SAMPLE || b[1].length < MIN_SAMPLE ? `At least one group has fewer than ${MIN_SAMPLE} records — differences may not be meaningful.` : undefined }} />;
}

const DIMENSIONS: { key: string; label: string; get: (r: Injury) => string }[] = [
  { key: "sport", label: "Sport", get: (r) => r.sport }, { key: "category", label: "Individual vs team", get: (r) => r.sportCategory }, { key: "age", label: "Age group", get: (r) => r.ageGroup },
  { key: "context", label: "Competition vs training", get: (r) => r.context }, { key: "level", label: "Amateur vs professional", get: (r) => r.level }, { key: "institution", label: "School / institution / club", get: (r) => r.institution },
  { key: "region", label: "Anatomical location", get: (r) => r.region }, { key: "severity", label: "Severity", get: (r) => r.severity }, { key: "status", label: "Recovery status", get: (r) => r.statusGroup },
];
function SportSection({ rows }: { rows: Injury[] }) {
  const [dim, setDim] = useState("sport");
  const d = DIMENSIONS.find((x) => x.key === dim)!;
  const counts = countBy(rows, d.get);
  const [cmp, setCmp] = useState({ a: "", b: "" });
  return <div className="space-y-4"><Empty rows={rows} />
    <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Sex and playing position are not stored on athlete records yet, so they cannot be analysed. Competition level and activity context appear once clinicians record them on cases.</p>
    <select className={`${selectClass} max-w-xs`} value={dim} onChange={(e) => { setDim(e.target.value); setCmp({ a: "", b: "" }); }}>{DIMENSIONS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
    <div className="grid gap-4 lg:grid-cols-2"><Card title={`Injuries by ${d.label.toLowerCase()}`}><BarView data={counts} /></Card><Card title="Table"><DataTable t={distTable(d.label, counts)} /></Card></div>
    <Card title={`Compare two ${d.label.toLowerCase()} groups`}><div className="mb-3 grid gap-2 sm:grid-cols-2">{(["a", "b"] as const).map((k) => <select key={k} className={selectClass} value={cmp[k]} onChange={(e) => setCmp({ ...cmp, [k]: e.target.value })}><option value="">Choose group {k.toUpperCase()}</option>{counts.map((x) => <option key={x.name}>{x.name}</option>)}</select>)}</div>{cmp.a && cmp.b && <Compare a={[cmp.a, rows.filter((r) => d.get(r) === cmp.a)]} b={[cmp.b, rows.filter((r) => d.get(r) === cmp.b)]} />}</Card>
  </div>;
}

function RecurrenceSection({ rows, exposureHours, admin, athletes }: { rows: Injury[]; exposureHours: number; admin: boolean; athletes: number }) {
  const pseudo = pseudonymiser();
  const byAthlete = new Map<string, Injury[]>();
  for (const r of rows) byAthlete.set(r.athleteId, [...(byAthlete.get(r.athleteId) ?? []), r]);
  const repeaters = [...byAthlete].filter(([, xs]) => xs.length > 1 || xs.some((x) => x.recurrent));
  const inc = incidencePer1000(rows.length, exposureHours);
  const derived = rows.filter((r) => r.recurrenceSource === "derived").length;
  return <div className="space-y-4"><Empty rows={rows} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="First-time injuries" value={rows.filter((r) => !r.recurrent).length} /><Stat label="Recurrent injuries" value={rows.filter((r) => r.recurrent).length} hint={derived ? `${derived} inferred from an earlier same-site injury` : undefined} /><Stat label="Athletes with repeat injuries" value={repeaters.length} /><Stat label="Same-site repeats" value={rows.filter((r) => r.sameSiteRepeat).length} /></div>
    <Card title="Incidence per 1,000 athlete-hours" note="Incidence uses logged exposure hours. Raw counts above are not incidence.">{inc == null ? <p className="text-sm text-muted-foreground">Not available — no exposure hours are logged for the filtered athletes and period. Raw injury count: {rows.length}.</p> : <p className="text-2xl font-bold">{inc} <span className="text-sm font-normal text-muted-foreground">injuries / 1,000 h ({rows.length} injuries over {Math.round(exposureHours * 10) / 10} h)</span></p>}</Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card title="Most frequent locations"><BarView data={countBy(rows, (r) => r.region).slice(0, 8)} /></Card><Card title="Recurrent injuries by sport"><BarView data={countBy(rows.filter((r) => r.recurrent), (r) => r.sport)} /></Card></div>
    <Card title="Recurrence over time (by year)"><DataTable t={{ title: "", headers: ["Year", "Injuries", "Recurrent", "Recurrence rate"], rows: timeSeries(rows, "year").map((s) => [s.period, s.total, s.recurrent, show(pct(s.recurrent, s.total), "%")]) }} /></Card>
    <Card title="Athletes with repeat injuries (pseudonymised)"><DataTable t={{ title: "", headers: ["Athlete", "Injuries", "Locations", "Recurrent"], rows: repeaters.map(([id, xs]) => [pseudo(id), xs.length, [...new Set(xs.map((x) => x.region))].join(", "), xs.filter((x) => x.recurrent).length]) }} /></Card>
    <ExposureLog admin={admin} athletes={athletes} />
  </div>;
}

function ExposureLog({ admin, athletes }: { admin: boolean; athletes: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: list } = useSuspenseQuery(queryOptions({ queryKey: ["research-athletes"], queryFn: () => all(supabase.from("athletes").select("id, athlete_code, first_name, surname").order("surname")) }));
  return <Card title="Log athlete exposure hours" note="Training and competition hours enable incidence rates. Staff only.">
    {!open ? <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!athletes}>Add exposure session</Button> :
      <SimpleForm submitLabel="Save exposure" fields={[{ name: "athlete_id", label: "Athlete", type: "select", required: true, options: list.map((a) => ({ value: a.id, label: `${a.surname}, ${a.first_name} (${a.athlete_code})` })) }, { name: "session_date", label: "Date", type: "date", required: true }, { name: "session_type", label: "Session", type: "select", required: true, options: [{ value: "training", label: "Training" }, { value: "competition", label: "Competition" }] }, { name: "hours", label: "Hours (0–24)", type: "number", required: true }, { name: "notes", label: "Notes", type: "textarea" }]}
        onSubmit={async (v) => {
          const hours = Number(v.hours);
          if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error("Enter hours between 0 and 24.");
          const { data: u } = await supabase.auth.getUser();
          const { error } = await supabase.from("athlete_exposures").insert({ athlete_id: v.athlete_id!, session_date: v.session_date!, session_type: v.session_type!, hours, notes: v.notes || null, created_by: u.user?.id ?? null });
          if (error) throw new Error(error.message);
          toast.success("Exposure saved");
          await qc.invalidateQueries({ queryKey: ["research-dataset"] });
        }} />}
    {admin && null}
  </Card>;
}

function RecoverySection({ rows }: { rows: Injury[] }) {
  const recDays = rows.map(recoveryDays).filter((d): d is number => d != null);
  const cutoff = prolongedCutoff(recDays);
  const pseudo = pseudonymiser();
  const by = (k: (r: Injury) => string): Table => {
    const groups = [...new Set(rows.map(k))].sort();
    return { title: "", headers: ["Group", "Injuries", "Resolved", "% resolved", "In rehab", "Mean recovery (d)", "Median (d)", "Recurrence after recovery"], rows: groups.map((g) => {
      const xs = rows.filter((r) => k(r) === g), d = xs.map(recoveryDays).filter((v): v is number => v != null);
      return [g, xs.length, xs.filter((x) => x.statusGroup === "Resolved").length, show(pct(xs.filter((x) => x.statusGroup === "Resolved").length, xs.length), "%"), xs.filter((x) => x.statusGroup === "In rehabilitation").length, show(avg(d)), show(median(d)), xs.filter((x) => x.recurrent && rows.some((p) => p.athleteId === x.athleteId && p.region === x.region && p.resolvedAt && p.resolvedAt <= x.date)).length];
    }) };
  };
  const a2r = rows.map((r) => daysBetween(r.firstAssessment, r.rehabStart)).filter((d): d is number => d != null);
  const i2a = rows.map((r) => daysBetween(r.date, r.firstAssessment)).filter((d): d is number => d != null);
  const withPlan = rows.filter((r) => r.rehabStart);
  return <div className="space-y-4"><Empty rows={rows} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="% resolved" value={show(pct(rows.filter((r) => r.statusGroup === "Resolved").length, rows.length), "%")} /><Stat label="% in rehabilitation" value={show(pct(rows.filter((r) => r.statusGroup === "In rehabilitation").length, rows.length), "%")} /><Stat label="Injury → assessment (mean)" value={show(avg(i2a), " d")} hint={`${i2a.length} cases`} /><Stat label="Assessment → rehab start (mean)" value={show(avg(a2r), " d")} hint={`${a2r.length} cases`} /><Stat label="Rehab completion rate" value={show(pct(withPlan.filter((r) => r.statusGroup === "Resolved").length, withPlan.length), "%")} hint={`${withPlan.length} cases with a rehab plan`} /></div>
    <Card title="Recovery duration distribution" note={recDays.length < MIN_SAMPLE ? `Insufficient data: ${recDays.length} resolved case(s) with dates.` : null}><BarView data={histogram(recDays)} /></Card>
    {[["By injury type", (r: Injury) => r.type], ["By severity", (r: Injury) => r.severity], ["By sport", (r: Injury) => r.sport]].map(([t, k]) => <Card key={t as string} title={`Recovery outcomes ${String(t).toLowerCase()}`}><DataTable t={by(k as (r: Injury) => string)} /></Card>)}
    <Card title="Unusually prolonged recoveries" note={cutoff == null ? `Needs at least ${MIN_SAMPLE} resolved cases with dates.` : `Statistical outlier above ${Math.round(cutoff)} days (Q3 + 1.5×IQR of recorded durations) — not a clinical benchmark.`}>{cutoff != null && <DataTable t={{ title: "", headers: ["Athlete", "Location", "Type", "Recovery (d)"], rows: rows.filter((r) => (recoveryDays(r) ?? 0) > cutoff).map((r) => [pseudo(r.athleteId), r.region, r.type, recoveryDays(r)]) }} />}</Card>
  </div>;
}

function TimelinessSection({ rows, thresholds, admin }: { rows: Injury[]; thresholds: Map<string, { key: string; label: string; days: number }>; admin: boolean }) {
  const qc = useQueryClient();
  const [dim, setDim] = useState("sport");
  const d = DIMENSIONS.find((x) => x.key === dim)!;
  const today = new Date().toISOString().slice(0, 10);
  const stats = TIMELINESS.map((i) => intervalStats(rows, i, thresholds.get(i.key)?.days ?? null));
  const fuLimit = thresholds.get("follow_up_overdue")?.days ?? null;
  const overdue = fuLimit == null ? null : rows.filter((r) => r.statusGroup !== "Resolved" && !r.nextFollowUp && (daysBetween(r.firstAssessment ?? r.reportedAt, today) ?? 0) > fuLimit);
  return <div className="space-y-4"><Empty rows={rows} />
    <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Prompt/delayed uses VITO's own administrative targets set below. These are internal service targets, not clinical guidelines.</p>
    <Card title="Interval summary (days)"><DataTable t={{ title: "", headers: ["Interval", "Cases with dates", "Missing dates", "Mean", "Median", "Min", "Max", "Target (d)", "Prompt", "Delayed"], rows: stats.map((s) => [s.label, s.n, s.missing, show(s.mean), show(s.median), show(s.min), show(s.max), thresholds.get(s.key)?.days ?? "Not set", s.prompt ?? "—", s.delayed ?? "—"]) }} /></Card>
    <div className="grid gap-4 lg:grid-cols-2">{TIMELINESS.slice(0, 2).map((i) => <Card key={i.key} title={`${i.label} distribution`}><BarView data={histogram(rows.map((r) => daysBetween(i.from(r), i.to(r))).filter((v): v is number => v != null))} /></Card>)}</div>
    <Card title="Open cases without an upcoming follow-up" note={fuLimit == null ? "Set the 'follow-up overdue' target to flag these." : `Unresolved, no future follow-up booked, and more than ${fuLimit} days since assessment/report.`}>{overdue && <p className="text-2xl font-bold">{overdue.length}</p>}</Card>
    <Card title="Investigate delays by group"><select className={`${selectClass} mb-3 max-w-xs`} value={dim} onChange={(e) => setDim(e.target.value)}>{DIMENSIONS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
      <DataTable t={{ title: "", headers: ["Group", ...TIMELINESS.map((i) => `${i.label} (median d)`)], rows: [...new Set(rows.map(d.get))].sort().map((g) => [g, ...TIMELINESS.map((i) => show(intervalStats(rows.filter((r) => d.get(r) === g), i, null).median))]) }} /></Card>
    <Card title="Administrative timeliness targets" note={admin ? "Only administrators can change these." : "Set by administrators."}>
      {admin ? <SimpleForm submitLabel="Save targets" resetOnSuccess={false} initial={Object.fromEntries([...TIMELINESS.map((i) => i.key), "follow_up_overdue"].map((k) => [k, String(thresholds.get(k)?.days ?? "")]))}
        fields={[...TIMELINESS.map((i) => ({ name: i.key, label: `${i.label} (days)`, type: "number" as const })), { name: "follow_up_overdue", label: "Follow-up overdue after (days)", type: "number" as const }]}
        onSubmit={async (v) => {
          const labels: Record<string, string> = { ...Object.fromEntries(TIMELINESS.map((i) => [i.key, i.label])), follow_up_overdue: "Follow-up overdue" };
          const { data: u } = await supabase.auth.getUser();
          const upserts = Object.entries(v).filter(([, x]) => x.trim()).map(([key, x]) => { const days = Number(x); if (!Number.isInteger(days) || days < 0) throw new Error("Targets must be whole numbers of days."); return { key, label: labels[key] ?? key, days, updated_by: u.user?.id ?? null }; });
          const { error } = await supabase.from("analytics_thresholds").upsert(upserts);
          if (error) throw new Error(error.message);
          toast.success("Targets saved");
          await qc.invalidateQueries({ queryKey: ["research-dataset"] });
        }} /> : <DataTable t={{ title: "", headers: ["Target", "Days"], rows: [...thresholds.values()].map((t) => [t.label, t.days]) }} />}
    </Card>
  </div>;
}

const REPORTS = [
  { key: "surveillance", label: "Injury surveillance report" }, { key: "monthly", label: "Monthly report" }, { key: "quarterly", label: "Quarterly report" }, { key: "annual", label: "Annual report" },
  { key: "sport", label: "Sport-specific report" }, { key: "anatomical", label: "Anatomical location report" }, { key: "recurrence", label: "Recurrence report" }, { key: "recovery", label: "Recovery outcomes report" }, { key: "timeliness", label: "Timeliness report" },
] as const;

function ReportsSection({ rows, filters, exposureHours, thresholds }: { rows: Injury[]; filters: Filters; exposureHours: number; thresholds: Map<string, { key: string; days: number }> }) {
  const [kind, setKind] = useState<(typeof REPORTS)[number]["key"]>("surveillance");
  const [identifiable, setIdentifiable] = useState(false);
  const [purpose, setPurpose] = useState("");
  const build = (): Report => {
    const o = overview(rows), label = REPORTS.find((r) => r.key === kind)!.label;
    const f = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    const inc = incidencePer1000(rows.length, exposureHours);
    const summary = [`${o.total} recorded injuries across ${o.athletes} athletes.`, `${o.recurrent} recurrent (${show(o.recurrenceRate, "%")}); ${o.resolved} resolved; ${o.awaiting} awaiting assessment.`, `Average recovery ${show(o.avgRecovery, " days")} (${o.recoverySample} cases with dates).`, inc == null ? "Incidence per 1,000 h not available: no exposure hours logged." : `Incidence ${inc} per 1,000 athlete-hours.`, sampleNote(rows.length) ?? "", "Values marked 'Not recorded' are missing on the source records; nothing is estimated."].filter(Boolean);
    const d = (t: string, k: (r: Injury) => string) => distTable(t, countBy(rows, k));
    const per = (p: Period, t: string): Table => ({ title: t, headers: ["Period", "Injuries", "First-time", "Recurrent"], rows: timeSeries(rows, p).map((s) => [s.period, s.total, s.first, s.recurrent]) });
    const tables: Record<string, Table[]> = {
      surveillance: [d("By location", (r) => r.region), d("By type", (r) => r.type), d("By mechanism", (r) => r.mechanism), d("By severity", (r) => r.severity), per("month", "Monthly trend")],
      monthly: [per("month", "Injuries per month"), d("By location", (r) => r.region)], quarterly: [per("quarter", "Injuries per quarter"), d("By type", (r) => r.type)], annual: [per("year", "Injuries per year"), d("By sport", (r) => r.sport)],
      sport: [d("By sport", (r) => r.sport), d("Individual vs team", (r) => r.sportCategory), d("Competition vs training", (r) => r.context)], anatomical: [d("By location", (r) => r.region), d("Original recorded body region", (r) => r.regionRaw)],
      recurrence: [d("First-time vs recurrent", (r) => (r.recurrent ? "Recurrent" : "First-time")), d("Recurrent by location", (r) => (r.recurrent ? r.region : "—"))],
      recovery: [d("Recovery status", (r) => r.statusGroup), { title: "Recovery duration distribution", headers: ["Days", "Cases"], rows: histogram(rows.map(recoveryDays).filter((v): v is number => v != null)).map((h) => [h.name, h.value]) }],
      timeliness: [{ title: "Intervals (days)", headers: ["Interval", "n", "Mean", "Median", "Target", "Delayed"], rows: TIMELINESS.map((i) => { const s = intervalStats(rows, i, thresholds.get(i.key)?.days ?? null); return [s.label, s.n, s.mean, s.median, thresholds.get(i.key)?.days ?? "Not set", s.delayed]; }), note: "Targets are VITO administrative targets, not clinical guidelines." }],
    };
    const pseudo = pseudonymiser();
    const detail: Table = { title: identifiable ? `Case-level records (identifiable — purpose: ${purpose})` : "Case-level records (pseudonymised)", headers: ["Athlete", "Injury date", "Location", "Type", "Severity", "Mechanism", "Status", "Recurrent", "Recovery (d)"], rows: rows.map((r) => [identifiable ? r.athleteId : pseudo(r.athleteId), r.date, r.region, r.type, r.severity, r.mechanism, r.statusGroup, r.recurrent ? "Yes" : "No", recoveryDays(r)]) };
    return { title: `VITO Physio — ${label}`, generated: new Date().toLocaleString(), filters: f.length ? f : ["No filters (all recorded injuries)"], summary, tables: [...tables[kind]!, detail] };
  };
  const run = (fmt: "csv" | "xls" | "pdf") => {
    if (identifiable && purpose.trim().length < 10) return toast.error("Describe the authorised clinical purpose before exporting identifiable data.");
    const r = build(), name = `vito-${kind}-${new Date().toISOString().slice(0, 10)}`;
    try {
      if (fmt === "csv") download(`${name}.csv`, toCsv(r), "text/csv;charset=utf-8");
      else if (fmt === "xls") download(`${name}.xls`, toExcelXml(r), "application/vnd.ms-excel");
      else printPdf(r);
    } catch (e) { toast.error((e as Error).message); }
  };
  return <Card title="Reports & exports" note="Reports include generation date, active filters, summary and tables. Athletes are pseudonymised (ATH-0001…) by default.">
    <div className="space-y-3">
      <select className={`${selectClass} max-w-sm`} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={identifiable} onChange={(e) => setIdentifiable(e.target.checked)} /><span>Include athlete record IDs for an authorised clinical purpose</span></label>
      {identifiable && <Input placeholder="Authorised clinical purpose (required)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />}
      <div className="flex flex-wrap gap-2"><Button onClick={() => run("pdf")}>PDF (print)</Button><Button variant="outline" onClick={() => run("xls")}>Excel</Button><Button variant="outline" onClick={() => run("csv")}>CSV</Button></div>
      <p className="text-xs text-muted-foreground">{rows.length} injuries in this report. Charts are shown on-screen; exports contain the underlying tables.</p>
    </div>
  </Card>;
}
