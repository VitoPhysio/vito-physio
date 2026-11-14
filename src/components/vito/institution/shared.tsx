import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Count, InjuryFilters, InjuryRecord } from "@/lib/injury-analytics";
import { cn } from "@/lib/utils";

export type InstAthlete = {
  id: string;
  athlete_code: string;
  first_name: string;
  surname: string;
  photo_path: string | null;
  date_of_birth: string | null;
  gender: string | null;
  sport: string | null;
  competition_level: string | null;
  phone: string | null;
  created_at: string;
  has_account: boolean;
  team_ids: string[];
  teams: string[];
  coaches: string[];
  active_injuries: number;
  total_injuries: number;
  rehab_phase: string | null;
};
export type InstTeam = { id: string; name: string; kind: string; sport: string | null; coach_id: string | null; coach_name: string | null; athlete_ids: string[] };
export type InstMember = { user_id: string; full_name: string | null; email: string | null; avatar_path: string | null; role: string; status: string; joined_at: string };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // Typed generically: every function below checks the caller's institution role in the database.
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export const instRpc = rpc;

export const useInstitutionAthletes = (school: string) =>
  useQuery({ queryKey: ["inst-athletes", school], queryFn: () => rpc<InstAthlete[]>("institution_athletes", { _school: school }) });
export const useInjuryRecords = (school: string) =>
  useQuery({
    queryKey: ["inst-injuries", school],
    queryFn: async () => (await rpc<InjuryRecord[]>("institution_injury_records", { _school: school })).map((r) => ({ ...r, team_ids: r.team_ids ?? [] })),
  });
export const useTeams = (school: string) =>
  useQuery({ queryKey: ["inst-teams", school], queryFn: () => rpc<InstTeam[]>("institution_teams_list", { _school: school }) });
export const useMembers = (school: string) =>
  useQuery({ queryKey: ["institution-members", school], queryFn: () => rpc<InstMember[]>("institution_members", { _school: school }) });

export const fullName = (a: { first_name: string; surname: string }) => `${a.first_name} ${a.surname}`;
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString() : "—");
export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
export const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm";

export function athleteStatus(a: Pick<InstAthlete, "active_injuries" | "total_injuries" | "rehab_phase">) {
  if (a.active_injuries > 0 && a.rehab_phase) return { label: "In rehabilitation", tone: "warn" as const };
  if (a.active_injuries > 0) return { label: "Injured", tone: "bad" as const };
  if (a.total_injuries > 0) return { label: "Recovered", tone: "good" as const };
  return { label: "Available", tone: "good" as const };
}

export function StatusPill({ tone, children }: { tone: "good" | "warn" | "bad" | "info"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "good" && "bg-primary/10 text-primary",
        tone === "warn" && "bg-accent/15 text-accent-foreground",
        tone === "bad" && "bg-destructive/10 text-destructive",
        tone === "info" && "bg-secondary text-secondary-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, onClick }: { label: string; value: ReactNode; hint?: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cn("rounded-2xl border bg-card p-3 text-left shadow-sm", onClick && "transition hover:border-primary")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Comp>
  );
}

/** Clickable bar list: selecting a row drills down by applying it as a filter. */
export function BarList({ data, onSelect, selected, empty = "No records for these filters.", limit = 8 }: {
  data: Count[];
  onSelect?: (label: string) => void;
  selected?: string | undefined;
  empty?: string;
  limit?: number;
}) {
  if (!data.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-1.5">
      {data.slice(0, limit).map((d) => (
        <li key={d.label}>
          <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(d.label)}
            className={cn("grid w-full grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm", onSelect && "hover:bg-secondary", selected === d.label && "bg-secondary font-semibold")}
          >
            <span className="truncate">{d.label}</span>
            <span className="h-2 rounded-full bg-secondary">
              <span className="block h-2 rounded-full bg-brand-gradient" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{d.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function InjuryFilterBar({ filters, onChange, records, teams, showAthlete = false, athletes = [] }: {
  filters: InjuryFilters;
  onChange: (f: InjuryFilters) => void;
  records: InjuryRecord[];
  teams: InstTeam[];
  showAthlete?: boolean;
  athletes?: InstAthlete[];
}) {
  const uniq = (vals: (string | null)[]) => [...new Set(vals.map((v) => (v ?? "").trim()).filter(Boolean).map((v) => v.charAt(0).toUpperCase() + v.slice(1)))].sort();
  const set = (k: keyof InjuryFilters, v: string) => onChange({ ...filters, [k]: v || undefined });
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3 print:hidden">
      <label className="grid gap-1 text-xs text-muted-foreground">From<input type="date" className={selectCls} value={filters.from ?? ""} onChange={(e) => set("from", e.target.value)} /></label>
      <label className="grid gap-1 text-xs text-muted-foreground">To<input type="date" className={selectCls} value={filters.to ?? ""} onChange={(e) => set("to", e.target.value)} /></label>
      <FilterSelect label="Sport" value={filters.sport} options={uniq(records.map((r) => r.sport))} onChange={(v) => set("sport", v)} />
      <label className="grid gap-1 text-xs text-muted-foreground">Team
        <select className={selectCls} value={filters.teamId ?? ""} onChange={(e) => set("teamId", e.target.value)}>
          <option value="">All</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      {showAthlete && (
        <label className="grid gap-1 text-xs text-muted-foreground">Athlete
          <select className={cn(selectCls, "max-w-[12rem]")} value={filters.athleteId ?? ""} onChange={(e) => set("athleteId", e.target.value)}>
            <option value="">All</option>
            {athletes.map((a) => <option key={a.id} value={a.id}>{fullName(a)}</option>)}
          </select>
        </label>
      )}
      <FilterSelect label="Body region" value={filters.bodyRegion} options={uniq(records.map((r) => r.body_region))} onChange={(v) => set("bodyRegion", v)} />
      <FilterSelect label="Injury type" value={filters.injuryType} options={uniq(records.map((r) => r.injury_type))} onChange={(v) => set("injuryType", v)} />
      <FilterSelect label="Severity" value={filters.severity} options={uniq(records.map((r) => r.severity))} onChange={(v) => set("severity", v)} />
      <label className="grid gap-1 text-xs text-muted-foreground">Recovery
        <select className={selectCls} value={filters.status ?? ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">All</option><option value="active">Still injured</option><option value="recovered">Recovered</option>
        </select>
      </label>
      {active && <Button variant="ghost" size="sm" onClick={() => onChange({})}>Clear filters</Button>}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string | undefined; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">{label}
      <select className={cn(selectCls, "max-w-[11rem]")} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function Loading({ what }: { what: string }) {
  return <p className="text-sm text-muted-foreground">Loading {what}…</p>;
}
export function LoadError({ error }: { error: unknown }) {
  return <p className="text-sm text-destructive">Could not load: {error instanceof Error ? error.message : "unknown error"}</p>;
}
