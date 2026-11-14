/**
 * Institution injury analytics and transparent, rule-based pattern detection.
 * Everything here is computed from real database rows; nothing is estimated or invented.
 * Patterns describe observed associations only — never a diagnosed cause or a prediction.
 */
export type InjuryRecord = {
  id: string;
  injury_code: string;
  athlete_id: string;
  athlete_name: string;
  sport: string | null;
  gender: string | null;
  date_of_birth: string | null;
  team_ids: string[];
  body_region: string;
  injury_type: string | null;
  severity: string | null;
  mechanism_category: string | null;
  activity_context: string | null;
  onset_type: string | null;
  is_recurrence: boolean | null;
  injury_date: string;
  resolved_at: string | null;
  days_lost: number | null;
  status: string;
  created_at: string;
  assessed: boolean;
  rehab_phase: string | null;
  target_return_date: string | null;
  last_review_date: string | null;
};

export type AthleteSummaryInput = {
  id: string;
  active_injuries: number;
  total_injuries: number;
  rehab_phase: string | null;
  created_at: string;
};

export const CLOSED_STATUSES = ["closed", "resolved", "recovered"];
export const DAY = 86_400_000;

export const PATTERN_DISCLAIMER =
  "Patterns are observed associations in your institution's records, found with simple counting rules. They are not a diagnosis of cause or a prediction of injury. Ask a qualified professional to review them before changing training or care.";

export function isActive(r: Pick<InjuryRecord, "status">): boolean {
  return !CLOSED_STATUSES.includes((r.status ?? "").toLowerCase());
}

const toTime = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00Z` : d).getTime();
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);

export function recoveryDays(r: InjuryRecord): number | null {
  if (!r.resolved_at) return null;
  const d = daysBetween(r.injury_date, r.resolved_at);
  return d >= 0 ? d : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? null) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

export function ageAt(dob: string | null, at: string): number | null {
  if (!dob) return null;
  const b = new Date(`${dob.slice(0, 10)}T00:00:00Z`);
  const d = new Date(at.length === 10 ? `${at}T00:00:00Z` : at);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

export function ageGroup(dob: string | null, at: string): string {
  const age = ageAt(dob, at);
  if (age === null) return "Age not recorded";
  if (age < 13) return "Under 13";
  if (age <= 15) return "13–15";
  if (age <= 18) return "16–18";
  if (age <= 23) return "19–23";
  return "24 and over";
}

const label = (v: string | null | undefined, fallback = "Not recorded") => {
  const t = (v ?? "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : fallback;
};
export const regionKey = (r: string) => r.trim().toLowerCase();

export type InjuryFilters = {
  from?: string;
  to?: string;
  sport?: string;
  teamId?: string;
  athleteId?: string;
  injuryType?: string;
  severity?: string;
  bodyRegion?: string;
  status?: "" | "active" | "recovered";
};

export function filterRecords(records: InjuryRecord[], f: InjuryFilters): InjuryRecord[] {
  return records.filter((r) => {
    const day = r.injury_date.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.sport && label(r.sport) !== f.sport) return false;
    if (f.teamId && !r.team_ids.includes(f.teamId)) return false;
    if (f.athleteId && r.athlete_id !== f.athleteId) return false;
    if (f.injuryType && label(r.injury_type) !== f.injuryType) return false;
    if (f.severity && label(r.severity) !== f.severity) return false;
    if (f.bodyRegion && label(r.body_region) !== f.bodyRegion) return false;
    if (f.status === "active" && !isActive(r)) return false;
    if (f.status === "recovered" && isActive(r)) return false;
    return true;
  });
}

export type Count = { label: string; count: number };
export function countBy(records: InjuryRecord[], key: (r: InjuryRecord) => string): Count[] {
  const m = new Map<string, number>();
  for (const r of records) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([l, count]) => ({ label: l, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export const byRegion = (rs: InjuryRecord[]) => countBy(rs, (r) => label(r.body_region));
export const byType = (rs: InjuryRecord[]) => countBy(rs, (r) => label(r.injury_type));
export const bySeverity = (rs: InjuryRecord[]) => countBy(rs, (r) => label(r.severity));
export const bySport = (rs: InjuryRecord[]) => countBy(rs, (r) => label(r.sport));
export const byContext = (rs: InjuryRecord[]) => countBy(rs, (r) => label(r.activity_context));
export const byAgeGroup = (rs: InjuryRecord[]) => countBy(rs, (r) => ageGroup(r.date_of_birth, r.injury_date));
export const byTeam = (rs: InjuryRecord[], teams: Map<string, string>) => {
  const out = new Map<string, number>();
  for (const r of rs) for (const t of r.team_ids.length ? r.team_ids : ["__none"]) out.set(t, (out.get(t) ?? 0) + 1);
  return [...out.entries()]
    .map(([id, count]) => ({ label: id === "__none" ? "No team" : (teams.get(id) ?? "Team"), count, id }))
    .sort((a, b) => b.count - a.count);
};

export function monthlyTrend(records: InjuryRecord[], now: Date, months = 12) {
  const out: { key: string; label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    out.push({ key, label: d.toLocaleString("en", { month: "short", year: "2-digit", timeZone: "UTC" }), count: 0 });
  }
  const idx = new Map(out.map((m, i) => [m.key, i]));
  for (const r of records) {
    const i = idx.get(r.injury_date.slice(0, 7));
    if (i !== undefined && out[i]) out[i].count++;
  }
  return out;
}

export function summarize(records: InjuryRecord[], athletes: AthleteSummaryInput[], now: Date) {
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10);
  const resolved = records.filter((r) => !isActive(r));
  const recoveries = records.map(recoveryDays).filter((d): d is number => d !== null);
  const recurring = records.filter((r) => r.is_recurrence).length;
  return {
    totalAthletes: athletes.length,
    activeAthletes: athletes.filter((a) => a.active_injuries === 0).length,
    injuredAthletes: athletes.filter((a) => a.active_injuries > 0).length,
    inRehabilitation: athletes.filter((a) => a.active_injuries > 0 && !!a.rehab_phase).length,
    recoveredAthletes: athletes.filter((a) => a.active_injuries === 0 && a.total_injuries > 0).length,
    totalInjuries: records.length,
    newReports30d: records.filter((r) => r.injury_date.slice(0, 10) >= since30).length,
    recurring,
    recurrenceRate: records.length ? recurring / records.length : 0,
    awaitingAssessment: records.filter((r) => isActive(r) && !r.assessed).length,
    medianRecoveryDays: median(recoveries),
    totalDaysLost: records.reduce((s, r) => s + (r.days_lost ?? 0), 0),
    returnToSportRate: records.length ? resolved.length / records.length : 0,
    rehabCompletionRate: (() => {
      const withRehab = records.filter((r) => r.rehab_phase);
      return withRehab.length ? withRehab.filter((r) => !isActive(r)).length / withRehab.length : null;
    })(),
  };
}

/** Athletes with an open injury that has not been assessed, or whose last review is over 14 days old. */
export function needsFollowUp(records: InjuryRecord[], now: Date) {
  return records.filter((r) => {
    if (!isActive(r)) return false;
    if (!r.assessed) return true;
    const last = r.last_review_date ?? r.injury_date;
    return now.getTime() - toTime(last) > 14 * DAY;
  });
}

// ---------- Pattern detection ----------
export const PATTERN_RULES = {
  windowDays: 90,
  clusterMin: 3,
  clusterAlert: 5,
  riseFactor: 2,
  surgeWindowDays: 30,
  surgeMin: 3,
  repeatWindowDays: 365,
  longRehabFactor: 1.5,
  longRehabMinResolved: 3,
};

export type PatternLevel = "watch" | "alert";
export type InjuryPattern = {
  key: string;
  kind: "cluster" | "rise" | "surge" | "repeat" | "long_rehab";
  level: PatternLevel;
  title: string;
  observation: string;
  stats: string[];
  scope: string;
  period: string;
  investigate: string[];
  recommendations: string[];
  recordIds: string[];
};

const REGION_GUIDANCE: { match: RegExp; tips: string[] }[] = [
  { match: /ankle|foot|heel|achilles|calf|shin/, tips: ["Add balance and proprioception drills to warm-ups", "Check footwear and playing surfaces", "Review taping or bracing for athletes with a previous ankle injury"] },
  { match: /knee|acl|menisc|patell/, tips: ["Introduce neuromuscular warm-ups that coach landing and cutting technique", "Strengthen hamstrings, quadriceps and hips", "Review jumping and change-of-direction training loads"] },
  { match: /hamstring|thigh|groin|hip|quad/, tips: ["Add progressive eccentric hamstring and adductor strengthening", "Build sprint exposure gradually", "Review warm-up length and intensity before sprinting"] },
  { match: /shoulder|elbow|wrist|hand|arm/, tips: ["Add shoulder and rotator-cuff strengthening", "Review throwing, striking or contact technique", "Monitor throwing and overhead workloads"] },
  { match: /back|spine|neck|lumbar/, tips: ["Strengthen trunk and core", "Review lifting and sport technique", "Check training volume and recovery time"] },
  { match: /head|concuss|face/, tips: ["Review concussion recognition and removal-from-play procedures", "Check protective equipment and rules of contact", "Make sure athletes complete a graded return-to-play"] },
];
const GENERAL_TIPS = ["Review warm-up routines", "Review training loads and scheduling", "Assess playing surfaces and equipment", "Strengthen conditioning programmes"];

export function preventionTips(region: string | null, kind: InjuryPattern["kind"]): string[] {
  const tips: string[] = [];
  const r = (region ?? "").toLowerCase();
  const g = REGION_GUIDANCE.find((x) => x.match.test(r));
  if (g) tips.push(...g.tips);
  if (kind === "repeat") tips.push("Review rehabilitation completion and return-to-play criteria", "Refer affected athletes for professional assessment");
  else if (kind === "long_rehab") tips.push("Refer athletes with prolonged recovery for professional review", "Check attendance and progress in rehabilitation programmes");
  else if (kind === "surge") tips.push("Review recent changes in training intensity, fixtures or surfaces", "Plan recovery days around heavy fixture periods");
  for (const t of GENERAL_TIPS) if (tips.length < 5 && !tips.includes(t)) tips.push(t);
  return tips.slice(0, 6);
}

const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);

export function detectPatterns(records: InjuryRecord[], opts: { now: Date; teams?: Map<string, string> }): InjuryPattern[] {
  const R = PATTERN_RULES;
  const now = opts.now.getTime();
  const teams = opts.teams ?? new Map<string, string>();
  const inWindow = (r: InjuryRecord, startDaysAgo: number, endDaysAgo = 0) => {
    const t = toTime(r.injury_date);
    return t > now - startDaysAgo * DAY && t <= now - endDaysAgo * DAY;
  };
  const patterns: InjuryPattern[] = [];
  const recent = records.filter((r) => inWindow(r, R.windowDays));
  const period = `${fmtDate(now - R.windowDays * DAY)} to ${fmtDate(now)}`;

  // 1. Clusters of the same body region within a team or sport
  const groups = new Map<string, { scope: string; region: string; ids: string[]; athletes: Set<string> }>();
  for (const r of recent) {
    const region = label(r.body_region);
    const scopes = [...r.team_ids.map((t) => `team:${t}`), r.sport ? `sport:${label(r.sport)}` : null].filter(Boolean) as string[];
    for (const s of scopes) {
      const key = `${s}|${regionKey(region)}`;
      const g = groups.get(key) ?? { scope: s, region, ids: [], athletes: new Set<string>() };
      g.ids.push(r.id);
      g.athletes.add(r.athlete_id);
      groups.set(key, g);
    }
  }
  const teamClusterSizes = new Set<string>();
  const sorted = [...groups.entries()].sort(([a], [b]) => (a.startsWith("team:") ? -1 : 1) - (b.startsWith("team:") ? -1 : 1));
  for (const [key, g] of sorted) {
    if (g.ids.length < R.clusterMin) continue;
    const isTeam = g.scope.startsWith("team:");
    const scopeName = isTeam ? (teams.get(g.scope.slice(5)) ?? "A team") : g.scope.slice(6);
    const sig = `${regionKey(g.region)}|${g.ids.slice().sort().join(",")}`;
    if (!isTeam && teamClusterSizes.has(sig)) continue;
    if (isTeam) teamClusterSizes.add(sig);
    patterns.push({
      key: `cluster:${key}`,
      kind: "cluster",
      level: g.ids.length >= R.clusterAlert ? "alert" : "watch",
      title: `Repeated ${g.region.toLowerCase()} injuries in ${scopeName}`,
      observation: `${g.ids.length} ${g.region.toLowerCase()} injuries were recorded in ${scopeName} in the last ${R.windowDays} days.`,
      stats: [`${g.ids.length} injuries`, `${g.athletes.size} athletes affected`],
      scope: isTeam ? `Team: ${scopeName}` : `Sport: ${scopeName}`,
      period,
      investigate: ["When and where did these injuries happen (training or competition)?", "Were there recent changes in training load, surface or equipment?", "Did affected athletes have a previous injury in the same area?"],
      recommendations: preventionTips(g.region, "cluster"),
      recordIds: g.ids,
    });
  }

  // 2. Rising body-region counts compared with the previous window
  const regions = new Set(records.map((r) => regionKey(r.body_region)));
  for (const reg of regions) {
    const cur = records.filter((r) => regionKey(r.body_region) === reg && inWindow(r, R.windowDays));
    const prev = records.filter((r) => regionKey(r.body_region) === reg && inWindow(r, R.windowDays * 2, R.windowDays));
    if (cur.length >= R.clusterMin && prev.length > 0 && cur.length >= prev.length * R.riseFactor) {
      const name = label(cur[0]?.body_region).toLowerCase();
      patterns.push({
        key: `rise:${reg}`,
        kind: "rise",
        level: cur.length >= prev.length * 3 ? "alert" : "watch",
        title: `Increase in ${name} injuries`,
        observation: `${name} injuries rose from ${prev.length} to ${cur.length} compared with the previous ${R.windowDays} days.`,
        stats: [`Previous period: ${prev.length}`, `Current period: ${cur.length}`, `${(cur.length / prev.length).toFixed(1)}× change`],
        scope: "Whole institution",
        period,
        investigate: ["Which teams or sports account for the increase?", "Did the season, fixtures or training programme change?"],
        recommendations: preventionTips(name, "rise"),
        recordIds: cur.map((r) => r.id),
      });
    }
  }

  // 3. Surges in reports for a team (or the whole institution) over the last 30 days
  const surgeScopes: { id: string; name: string; filter: (r: InjuryRecord) => boolean }[] = [
    { id: "all", name: "the whole institution", filter: () => true },
    ...[...teams.entries()].map(([id, name]) => ({ id, name, filter: (r: InjuryRecord) => r.team_ids.includes(id) })),
  ];
  for (const s of surgeScopes) {
    const cur = records.filter((r) => s.filter(r) && inWindow(r, R.surgeWindowDays));
    const prev = records.filter((r) => s.filter(r) && inWindow(r, R.surgeWindowDays * 2, R.surgeWindowDays));
    const min = s.id === "all" ? R.surgeMin + 1 : R.surgeMin;
    if (cur.length >= min && prev.length > 0 && cur.length >= prev.length * R.riseFactor) {
      patterns.push({
        key: `surge:${s.id}`,
        kind: "surge",
        level: "watch",
        title: `Injury reports rising in ${s.name}`,
        observation: `${cur.length} injuries were reported in the last ${R.surgeWindowDays} days, up from ${prev.length} in the ${R.surgeWindowDays} days before.`,
        stats: [`Last ${R.surgeWindowDays} days: ${cur.length}`, `Previous ${R.surgeWindowDays} days: ${prev.length}`],
        scope: s.id === "all" ? "Whole institution" : `Team: ${s.name}`,
        period: `${fmtDate(now - R.surgeWindowDays * DAY)} to ${fmtDate(now)}`,
        investigate: ["Has there been a busy fixture or training period?", "Were new drills, surfaces or equipment introduced?"],
        recommendations: preventionTips(null, "surge"),
        recordIds: cur.map((r) => r.id),
      });
    }
  }

  // 4. Athletes returning with the same injury
  const byAthleteRegion = new Map<string, InjuryRecord[]>();
  for (const r of records.filter((x) => inWindow(x, R.repeatWindowDays))) {
    const k = `${r.athlete_id}|${regionKey(r.body_region)}`;
    byAthleteRegion.set(k, [...(byAthleteRegion.get(k) ?? []), r]);
  }
  const repeats = [...byAthleteRegion.values()].filter((v) => v.length >= 2);
  if (repeats.length) {
    const ids = repeats.flat().map((r) => r.id);
    const regionsList = [...new Set(repeats.map((v) => label(v[0]?.body_region).toLowerCase()))];
    patterns.push({
      key: "repeat:athletes",
      kind: "repeat",
      level: repeats.length >= 3 ? "alert" : "watch",
      title: "Athletes returning with the same injury",
      observation: `${repeats.length} athlete${repeats.length === 1 ? " has" : "s have"} been injured more than once in the same body region within a year.`,
      stats: [`${repeats.length} athlete${repeats.length === 1 ? "" : "s"}`, `${ids.length} injuries`, `Regions: ${regionsList.join(", ")}`],
      scope: "Individual athletes",
      period: `${fmtDate(now - R.repeatWindowDays * DAY)} to ${fmtDate(now)}`,
      investigate: ["Did these athletes complete their rehabilitation before returning?", "Were return-to-play criteria applied?"],
      recommendations: preventionTips(regionsList.length === 1 ? (regionsList[0] ?? null) : null, "repeat"),
      recordIds: ids,
    });
  }

  // 5. Longer-than-usual rehabilitation compared with similar injuries
  const bySev = new Map<string, number[]>();
  for (const r of records) {
    const d = recoveryDays(r);
    if (d !== null) bySev.set(label(r.severity), [...(bySev.get(label(r.severity)) ?? []), d]);
  }
  const slow: InjuryRecord[] = [];
  for (const r of records) {
    const values = bySev.get(label(r.severity)) ?? [];
    if (values.length < R.longRehabMinResolved) continue;
    const m = median(values) ?? 0;
    const limit = Math.max(m * R.longRehabFactor, m + 14);
    const duration = isActive(r) ? daysBetween(r.injury_date, fmtDate(now)) : (recoveryDays(r) ?? 0);
    if (duration > limit && (isActive(r) || inWindow(r, 180))) slow.push(r);
  }
  if (slow.length) {
    patterns.push({
      key: "long_rehab",
      kind: "long_rehab",
      level: slow.length >= 3 ? "alert" : "watch",
      title: "Longer-than-usual rehabilitation",
      observation: `${slow.length} injur${slow.length === 1 ? "y has" : "ies have"} taken more than ${R.longRehabFactor}× the usual recovery time for injuries of the same severity in your records.`,
      stats: [`${slow.length} injuries`, `${slow.filter(isActive).length} still open`],
      scope: "Individual athletes",
      period: "All records",
      investigate: ["Are these athletes attending rehabilitation?", "Is a professional review or referral needed?"],
      recommendations: preventionTips(null, "long_rehab"),
      recordIds: slow.map((r) => r.id),
    });
  }

  return patterns.sort((a, b) => Number(b.level === "alert") - Number(a.level === "alert") || b.recordIds.length - a.recordIds.length);
}

// ---------- Bulk athlete import ----------
export type AthleteImportRow = {
  first_name: string;
  surname: string;
  sport?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  competition_level?: string;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows.map((r) => r.map((v) => v.trim()));
}

const HEADER_ALIASES: Record<keyof AthleteImportRow, string[]> = {
  first_name: ["first name", "firstname", "first_name", "given name", "first"],
  surname: ["surname", "last name", "lastname", "last_name", "family name"],
  sport: ["sport", "discipline"],
  date_of_birth: ["date of birth", "dob", "date_of_birth", "birth date", "birthday"],
  gender: ["gender", "sex"],
  phone: ["phone", "telephone", "mobile", "contact"],
  competition_level: ["level", "competition level", "competition_level", "class", "grade"],
};

export function parseAthleteCsv(text: string): { rows: AthleteImportRow[]; errors: string[] } {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length < 2) return { rows: [], errors: ["Add a header row and at least one athlete."] };
  const header = (table[0] ?? []).map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const col = (k: keyof AthleteImportRow) => header.findIndex((h) => HEADER_ALIASES[k].includes(h));
  const idx = Object.fromEntries((Object.keys(HEADER_ALIASES) as (keyof AthleteImportRow)[]).map((k) => [k, col(k)])) as Record<keyof AthleteImportRow, number>;
  if (idx.first_name < 0 || idx.surname < 0) return { rows: [], errors: ["The header must include First name and Surname columns."] };
  const rows: AthleteImportRow[] = [];
  table.slice(1).forEach((r, i) => {
    const get = (k: keyof AthleteImportRow) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
    const row: AthleteImportRow = { first_name: get("first_name"), surname: get("surname") };
    if (!row.first_name || !row.surname) { errors.push(`Row ${i + 2}: first name and surname are required.`); return; }
    for (const k of ["sport", "date_of_birth", "gender", "phone", "competition_level"] as const) {
      const v = get(k);
      if (v) row[k] = v;
    }
    if (row.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth)) {
      errors.push(`Row ${i + 2}: date of birth must look like 2010-04-23; it was left blank.`);
      delete row.date_of_birth;
    }
    rows.push(row);
  });
  return { rows, errors };
}
