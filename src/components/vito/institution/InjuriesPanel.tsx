import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  byRegion, bySeverity, bySport, byTeam, byType, detectPatterns, filterRecords, isActive, monthlyTrend,
  needsFollowUp, PATTERN_DISCLAIMER, summarize, type InjuryFilters,
} from "@/lib/injury-analytics";
import { institutionPermissions } from "@/lib/institution";
import {
  BarList, fmtDate, fullName, InjuryFilterBar, instRpc, LoadError, Loading, Panel, pct, selectCls, StatCard, StatusPill,
  useInjuryRecords, useInstitutionAthletes, useTeams,
} from "./shared";

type Mode = "injuries" | "surveillance" | "rehabilitation" | "reports";

export function InjuriesPanel({ school, schoolName, perms, mode }: { school: string; schoolName: string; perms: ReturnType<typeof institutionPermissions>; mode: Mode }) {
  const records = useInjuryRecords(school);
  const athletes = useInstitutionAthletes(school);
  const { data: teams = [] } = useTeams(school);
  const [filters, setFilters] = useState<InjuryFilters>({});
  const now = useMemo(() => new Date(), []);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const list = useMemo(() => filterRecords(records.data ?? [], filters), [records.data, filters]);
  const patterns = useMemo(() => detectPatterns(records.data ?? [], { now, teams: teamMap }), [records.data, now, teamMap]);

  if (records.isLoading || athletes.isLoading) return <Loading what="injury records" />;
  if (records.error) return <LoadError error={records.error} />;
  const all = records.data ?? [];
  const s = summarize(list, athletes.data ?? [], now);
  const follow = needsFollowUp(list, now);
  const rehab = list.filter((r) => isActive(r) && r.rehab_phase);
  const trend = monthlyTrend(list, now);
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));

  return (
    <div className="space-y-4">
      {mode === "reports" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{schoolName} — injury report</h2>
            <p className="text-xs text-muted-foreground">Generated {now.toLocaleString()} · {list.length} injury records in view</p>
          </div>
          <Button onClick={() => window.print()} className="print:hidden"><Printer className="size-4" /> Print or save as PDF</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <InjuryFilterBar filters={filters} onChange={setFilters} records={all} teams={teams} showAthlete athletes={athletes.data ?? []} />
        {perms.reportInjury && mode === "injuries" && <ReportInjury school={school} />}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Injuries" value={s.totalInjuries} hint={`${s.newReports30d} in last 30 days`} />
        <StatCard label="Injured athletes" value={s.injuredAthletes} hint={`${s.inRehabilitation} in rehabilitation`} />
        <StatCard label="Awaiting assessment" value={s.awaitingAssessment} />
        <StatCard label="Median recovery" value={s.medianRecoveryDays === null ? "—" : `${s.medianRecoveryDays} d`} hint={`${s.totalDaysLost} days lost`} />
        <StatCard label="Recurrence rate" value={pct(s.recurrenceRate)} />
        <StatCard label="Returned to sport" value={pct(s.returnToSportRate)} />
        <StatCard label="Rehab completed" value={pct(s.rehabCompletionRate)} />
        <StatCard label="Needs follow-up" value={follow.length} />
      </div>

      {(mode === "surveillance" || mode === "reports") && (
        <>
          <Panel title="Pattern alerts">
            {patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unusual injury patterns detected right now.</p>
            ) : (
              <ul className="space-y-3">
                {patterns.map((p) => (
                  <li key={p.key} className="rounded-xl border p-3">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className={p.level === "alert" ? "size-4 text-destructive" : "size-4 text-muted-foreground"} />
                      {p.title} <StatusPill tone={p.level === "alert" ? "bad" : "warn"}>{p.level === "alert" ? "Alert" : "Watch"}</StatusPill>
                    </p>
                    <p className="mt-1 text-sm">{p.observation}</p>
                    <p className="text-xs text-muted-foreground">{p.scope} · {p.period}</p>
                    {p.recommendations.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm">{p.recommendations.map((t) => <li key={t}>{t}</li>)}</ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">{PATTERN_DISCLAIMER}</p>
          </Panel>
          <Panel title="Injuries by month">
            <div className="flex h-32 items-end gap-1">
              {trend.map((t) => (
                <div key={t.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-primary" style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: t.count ? 4 : 0 }} title={`${t.count}`} />
                  <span className="text-[10px] text-muted-foreground">{t.label}</span>
                </div>
              ))}
            </div>
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="By body region"><BarList data={byRegion(list)} /></Panel>
            <Panel title="By injury type"><BarList data={byType(list)} /></Panel>
            <Panel title="By severity"><BarList data={bySeverity(list)} /></Panel>
            <Panel title="By sport"><BarList data={bySport(list)} /></Panel>
            {teams.length > 0 && <Panel title="By team"><BarList data={byTeam(list, teamMap)} /></Panel>}
          </div>
        </>
      )}

      {mode === "rehabilitation" ? (
        <Panel title="Athletes in rehabilitation">
          <RecordTable rows={rehab} extra="rehab" />
        </Panel>
      ) : (
        <Panel title={mode === "injuries" ? "Injury records" : "Records in view"}>
          <RecordTable rows={list} />
        </Panel>
      )}
      {mode !== "reports" && follow.length > 0 && (
        <Panel title="Needs follow-up (not assessed or no review in 14 days)">
          <RecordTable rows={follow} />
        </Panel>
      )}
    </div>
  );
}

function RecordTable({ rows, extra }: { rows: ReturnType<typeof filterRecords>; extra?: "rehab" }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No records.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr><th className="p-2">Athlete</th><th className="p-2">Injury</th><th className="p-2">Severity</th><th className="p-2">Date</th><th className="p-2">{extra ? "Phase / target return" : "Status"}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-medium">{r.athlete_name}</td>
              <td className="p-2">{r.body_region}{r.injury_type ? ` · ${r.injury_type}` : ""}</td>
              <td className="p-2">{r.severity ?? "—"}</td>
              <td className="p-2">{fmtDate(r.injury_date)}</td>
              <td className="p-2">
                {extra ? `${r.rehab_phase ?? "—"} · ${fmtDate(r.target_return_date)}` : (
                  <StatusPill tone={isActive(r) ? (r.assessed ? "warn" : "bad") : "good"}>{isActive(r) ? (r.assessed ? "Under care" : "Awaiting assessment") : "Recovered"}</StatusPill>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportInjury({ school }: { school: string }) {
  const qc = useQueryClient();
  const { data: athletes = [] } = useInstitutionAthletes(school);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ athlete: "", body_region: "", injury_type: "", severity: "moderate", injury_date: new Date().toISOString().slice(0, 10), activity_context: "training", mechanism: "", notes: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    if (!f.athlete || !f.body_region.trim()) return void toast.error("Choose an athlete and enter the injured body part.");
    setBusy(true);
    try {
      await instRpc("institution_report_injury", {
        _school: school, _athlete: f.athlete, _body_region: f.body_region.trim(), _injury_type: f.injury_type.trim(), _severity: f.severity,
        _injury_date: f.injury_date, _activity_context: f.activity_context, _mechanism: f.mechanism.trim(), _notes: f.notes.trim(),
      });
      toast.success("Injury reported. A VITO clinician will review it.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["inst-injuries", school] });
      void qc.invalidateQueries({ queryKey: ["inst-athletes", school] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not report injury");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" /> Report injury</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Report an injury</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1">Athlete
            <select className={selectCls} value={f.athlete} onChange={set("athlete")}>
              <option value="">Choose athlete</option>
              {athletes.map((a) => <option key={a.id} value={a.id}>{fullName(a)} ({a.athlete_code})</option>)}
            </select>
          </Label>
          <Label className="grid gap-1">Body part<Input value={f.body_region} onChange={set("body_region")} placeholder="e.g. Ankle" /></Label>
          <Label className="grid gap-1">Injury type<Input value={f.injury_type} onChange={set("injury_type")} placeholder="e.g. Sprain" /></Label>
          <div className="grid grid-cols-2 gap-3">
            <Label className="grid gap-1">Severity
              <select className={selectCls} value={f.severity} onChange={set("severity")}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select>
            </Label>
            <Label className="grid gap-1">Date<Input type="date" value={f.injury_date} onChange={set("injury_date")} /></Label>
          </div>
          <Label className="grid gap-1">When it happened
            <select className={selectCls} value={f.activity_context} onChange={set("activity_context")}><option value="training">Training</option><option value="competition">Competition</option><option value="other">Other</option></select>
          </Label>
          <Label className="grid gap-1">How it happened<Input value={f.mechanism} onChange={set("mechanism")} /></Label>
          <Label className="grid gap-1">Notes<Textarea value={f.notes} onChange={set("notes")} /></Label>
          <Button onClick={submit} disabled={busy}>{busy ? "Reporting…" : "Submit report"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
