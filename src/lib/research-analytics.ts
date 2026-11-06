/**
 * Pure research & injury-surveillance calculations.
 * Uses recorded data only: nothing is estimated, imputed or benchmarked.
 */
export const NOT_RECORDED = "Not recorded";
export const MIN_SAMPLE = 5;

export const REGIONS = ["Head & neck", "Shoulder", "Arm & elbow", "Wrist & hand", "Back & spine", "Hip & groin", "Thigh", "Knee", "Lower leg", "Ankle", "Foot"] as const;
export const INJURY_TYPES = ["Sprain", "Strain", "Fracture", "Dislocation", "Contusion", "Tendinopathy", "Laceration", "Concussion", "Overuse injury", "Ligament tear", "Other"] as const;
export const MECHANISMS = ["Contact", "Non-contact", "Overuse", "Fall", "Collision", "Twisting", "Landing", "Other"] as const;
export const SEVERITIES = ["mild", "moderate", "severe", "critical"] as const;
export const TEAM_SPORTS = ["football", "soccer", "rugby", "basketball", "netball", "volleyball", "hockey", "handball", "cricket", "baseball", "softball"];

const REGION_KEYWORDS: [string, string[]][] = [
  ["Head & neck", ["head", "neck", "face", "skull", "cervical", "jaw", "eye", "nose"]],
  ["Shoulder", ["shoulder", "rotator", "clavicle", "collarbone", "scapula"]],
  ["Arm & elbow", ["arm", "elbow", "bicep", "tricep", "forearm", "humerus"]],
  ["Wrist & hand", ["wrist", "hand", "finger", "thumb", "palm"]],
  ["Back & spine", ["back", "spine", "lumbar", "thoracic", "trunk", "rib", "abdomen", "chest"]],
  ["Hip & groin", ["hip", "groin", "pelvis", "adductor", "glute", "buttock"]],
  ["Thigh", ["thigh", "hamstring", "quadricep", "quad", "femur"]],
  ["Knee", ["knee", "acl", "mcl", "pcl", "lcl", "menisc", "patella"]],
  ["Lower leg", ["shin", "calf", "tibia", "fibula", "achilles", "lower leg"]],
  ["Ankle", ["ankle"]],
  ["Foot", ["foot", "toe", "heel", "plantar", "metatarsal"]],
];

/** Maps free-text body regions onto the standard anatomical groups. */
export function normaliseRegion(raw: string | null | undefined): string {
  const text = (raw ?? "").trim().toLowerCase();
  if (!text) return NOT_RECORDED;
  // Specific joints first so "lower leg" or "ankle" are not swallowed by "leg"/"arm".
  for (const key of ["Ankle", "Knee", "Wrist & hand", "Lower leg", "Foot"]) {
    const hit = REGION_KEYWORDS.find(([k]) => k === key)!;
    if (hit[1].some((w) => text.includes(w))) return key;
  }
  for (const [key, words] of REGION_KEYWORDS) if (words.some((w) => text.includes(w))) return key;
  return "Other / unclassified";
}

export function sportCategory(sport: string | null | undefined): string {
  if (!sport?.trim()) return NOT_RECORDED;
  return TEAM_SPORTS.some((s) => sport.toLowerCase().includes(s)) ? "Team sport" : "Individual sport";
}

export function ageGroup(dob: string | null | undefined, at: string | null | undefined): string {
  if (!dob || !at) return NOT_RECORDED;
  const b = new Date(dob), d = new Date(at);
  if (!Number.isFinite(b.getTime()) || !Number.isFinite(d.getTime())) return NOT_RECORDED;
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age -= 1;
  if (age < 0) return NOT_RECORDED;
  if (age < 13) return "Under 13";
  if (age <= 15) return "13–15";
  if (age <= 18) return "16–18";
  if (age <= 24) return "19–24";
  if (age <= 34) return "25–34";
  return "35+";
}

export type RawInjury = {
  id: string; athlete_id: string; body_region: string; mechanism: string | null; injury_date: string | null; created_at: string; status: string;
  injury_type: string | null; severity: string | null; mechanism_category: string | null; onset_type: string | null; activity_context: string | null;
  is_recurrence: boolean | null; previous_injury_id: string | null; reported_at: string | null; resolved_at: string | null; days_lost: number | null;
};
export type RawAthlete = { id: string; sport: string | null; date_of_birth: string | null; competition_level: string | null; school_id: string | null; school_name: string | null };
export type Dated = { injury_id: string | null; date: string | null };
export type Dataset = {
  injuries: RawInjury[]; athletes: RawAthlete[];
  assessments: Dated[]; rehab: Dated[]; followUps: Dated[]; recovery: (Dated & { status: string })[];
  exposures: { athlete_id: string; session_date: string; session_type: string; hours: number }[];
};

export type Injury = {
  id: string; athleteId: string; date: string; dateRecorded: boolean; region: string; regionRaw: string; type: string; mechanism: string; severity: string;
  onset: string; context: string; status: string; statusGroup: "Active" | "In rehabilitation" | "Resolved" | "Awaiting assessment";
  recurrent: boolean; recurrenceSource: "recorded" | "derived" | "first"; sameSiteRepeat: boolean;
  sport: string; sportCategory: string; ageGroup: string; level: string; institution: string;
  reportedAt: string | null; firstAssessment: string | null; rehabStart: string | null; firstTreatment: string | null; resolvedAt: string | null; daysLost: number | null;
  nextFollowUp: string | null;
};

const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : null);
const minDate = (xs: (string | null)[]) => xs.filter((x): x is string => !!x).sort()[0] ?? null;
const RESOLVED = ["resolved", "recovered", "closed", "discharged", "completed", "returned to play", "return to play", "cleared"];
const isResolvedText = (s: string) => RESOLVED.some((r) => s.toLowerCase().includes(r));

export function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const d = Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

export function buildInjuries(ds: Dataset): Injury[] {
  const athletes = new Map(ds.athletes.map((a) => [a.id, a]));
  const group = <T extends Dated>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) if (r.injury_id) m.set(r.injury_id, [...(m.get(r.injury_id) ?? []), r]);
    return m;
  };
  const asm = group(ds.assessments), rehab = group(ds.rehab), fu = group(ds.followUps), rec = group(ds.recovery);
  const sorted = [...ds.injuries].sort((a, b) => (day(a.injury_date) ?? day(a.created_at)!).localeCompare(day(b.injury_date) ?? day(b.created_at)!));
  const seen = new Map<string, string[]>();
  const today = new Date().toISOString().slice(0, 10);
  return sorted.map((i) => {
    const a = athletes.get(i.athlete_id);
    const date = day(i.injury_date) ?? day(i.created_at)!;
    const region = normaliseRegion(i.body_region);
    const prior = seen.get(i.athlete_id) ?? [];
    seen.set(i.athlete_id, [...prior, region]);
    const sameSiteRepeat = region !== NOT_RECORDED && prior.includes(region);
    const recurrent = i.is_recurrence ?? sameSiteRepeat;
    const recoveries = (rec.get(i.id) ?? []).sort((x, y) => (x.date ?? "").localeCompare(y.date ?? ""));
    const resolvedUpdate = recoveries.find((r) => isResolvedText(r.status));
    const resolvedAt = day(i.resolved_at) ?? (isResolvedText(i.status) ? day(resolvedUpdate?.date) : day(resolvedUpdate?.date)) ?? null;
    const firstAssessment = minDate((asm.get(i.id) ?? []).map((r) => day(r.date)));
    const rehabStart = minDate((rehab.get(i.id) ?? []).map((r) => day(r.date)));
    const firstTreatment = minDate([rehabStart, ...(fu.get(i.id) ?? []).map((r) => day(r.date))]);
    const resolved = !!resolvedAt || isResolvedText(i.status);
    const statusGroup: Injury["statusGroup"] = resolved ? "Resolved" : rehabStart ? "In rehabilitation" : firstAssessment ? "Active" : "Awaiting assessment";
    const futureFu = (fu.get(i.id) ?? []).map((r) => day(r.date)).filter((d): d is string => !!d && d >= today).sort()[0] ?? null;
    return {
      id: i.id, athleteId: i.athlete_id, date, dateRecorded: !!i.injury_date, region, regionRaw: i.body_region,
      type: i.injury_type || NOT_RECORDED, mechanism: i.mechanism_category || NOT_RECORDED, severity: i.severity || NOT_RECORDED,
      onset: i.onset_type || NOT_RECORDED, context: i.activity_context || NOT_RECORDED, status: i.status, statusGroup,
      recurrent, recurrenceSource: i.is_recurrence != null ? "recorded" : sameSiteRepeat ? "derived" : "first", sameSiteRepeat,
      sport: a?.sport?.trim() || NOT_RECORDED, sportCategory: sportCategory(a?.sport), ageGroup: ageGroup(a?.date_of_birth, date),
      level: a?.competition_level || NOT_RECORDED, institution: a?.school_name || NOT_RECORDED,
      reportedAt: day(i.reported_at) ?? day(i.created_at), firstAssessment, rehabStart, firstTreatment, resolvedAt, daysLost: i.days_lost,
      nextFollowUp: futureFu,
    };
  });
}

export type Filters = {
  from: string; to: string; sport: string; type: string; region: string; severity: string; mechanism: string;
  category: string; institution: string; status: string; recurrence: "" | "recurrent" | "first"; recovery: "" | "resolved" | "unresolved";
};
export const EMPTY_FILTERS: Filters = { from: "", to: "", sport: "", type: "", region: "", severity: "", mechanism: "", category: "", institution: "", status: "", recurrence: "", recovery: "" };

export function applyFilters(rows: Injury[], f: Filters): Injury[] {
  return rows.filter((r) =>
    (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.sport || r.sport === f.sport) && (!f.type || r.type === f.type) &&
    (!f.region || r.region === f.region) && (!f.severity || r.severity === f.severity) && (!f.mechanism || r.mechanism === f.mechanism) &&
    (!f.category || r.sportCategory === f.category) && (!f.institution || r.institution === f.institution) && (!f.status || r.statusGroup === f.status) &&
    (!f.recurrence || (f.recurrence === "recurrent") === r.recurrent) && (!f.recovery || (f.recovery === "resolved") === (r.statusGroup === "Resolved")));
}

export const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

export function recoveryDays(r: Injury) { return daysBetween(r.date, r.resolvedAt); }

export function overview(rows: Injury[]) {
  const athletes = new Set(rows.map((r) => r.athleteId));
  const recDays = rows.map(recoveryDays).filter((d): d is number => d != null);
  const lost = rows.map((r) => r.daysLost).filter((d): d is number => d != null);
  const recurrentAthletes = new Set(rows.filter((r) => r.recurrent).map((r) => r.athleteId));
  return {
    total: rows.length, athletes: athletes.size,
    newCases: rows.filter((r) => !r.recurrent).length, recurrent: rows.filter((r) => r.recurrent).length,
    active: rows.filter((r) => r.statusGroup !== "Resolved").length, resolved: rows.filter((r) => r.statusGroup === "Resolved").length,
    inRehab: rows.filter((r) => r.statusGroup === "In rehabilitation").length, awaiting: rows.filter((r) => r.statusGroup === "Awaiting assessment").length,
    acute: rows.filter((r) => r.onset === "acute").length, chronic: rows.filter((r) => r.onset === "gradual").length,
    onsetRecorded: rows.filter((r) => r.onset !== NOT_RECORDED).length,
    avgRecovery: avg(recDays), recoverySample: recDays.length, avgDaysLost: avg(lost), daysLostSample: lost.length,
    recurrenceRate: pct(rows.filter((r) => r.recurrent).length, rows.length), recurrentAthletes: recurrentAthletes.size,
  };
}

export function countBy(rows: Injury[], key: (r: Injury) => string, order?: readonly string[]) {
  const m = new Map<string, number>();
  for (const k of order ?? []) m.set(k, 0);
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m].map(([name, value]) => ({ name, value, share: pct(value, rows.length) })).sort((a, b) => (order ? 0 : b.value - a.value));
}

export type Period = "day" | "week" | "month" | "quarter" | "half" | "year";
export function periodKey(date: string, p: Period): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`), y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (p === "day") return date.slice(0, 10);
  if (p === "month") return `${y}-${String(m + 1).padStart(2, "0")}`;
  if (p === "quarter") return `${y}-Q${Math.floor(m / 3) + 1}`;
  if (p === "half") return `${y}-H${m < 6 ? 1 : 2}`;
  if (p === "year") return String(y);
  const t = new Date(Date.UTC(y, m, d.getUTCDate()));
  const dn = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dn);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - ys.getTime()) / 86_400_000 + 1) / 7)).padStart(2, "0")}`;
}

export function timeSeries(rows: Injury[], p: Period) {
  const m = new Map<string, { period: string; total: number; first: number; recurrent: number }>();
  for (const r of rows) {
    const k = periodKey(r.date, p), e = m.get(k) ?? { period: k, total: 0, first: 0, recurrent: 0 };
    e.total += 1; if (r.recurrent) e.recurrent += 1; else e.first += 1;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function seasonal(rows: Injury[]) {
  return MONTHS.map((name, i) => ({ name, value: rows.filter((r) => Number(r.date.slice(5, 7)) === i + 1).length }));
}

export function crossTab(rows: Injury[], rowKey: (r: Injury) => string, colKey: (r: Injury) => string) {
  const rowsK = [...new Set(rows.map(rowKey))].sort(), cols = [...new Set(rows.map(colKey))].sort();
  return { rows: rowsK, cols, cell: (a: string, b: string) => rows.filter((r) => rowKey(r) === a && colKey(r) === b).length };
}

/** Incidence per 1,000 exposure hours. Returns null when no exposure is recorded, never an estimate. */
export function incidencePer1000(injuryCount: number, exposureHours: number): number | null {
  if (!(exposureHours > 0)) return null;
  return Math.round((injuryCount / exposureHours) * 1000 * 100) / 100;
}

export const TIMELINESS = [
  { key: "injury_to_report", label: "Injury → reported", from: (r: Injury) => r.date, to: (r: Injury) => r.reportedAt },
  { key: "report_to_assessment", label: "Reported → assessment", from: (r: Injury) => r.reportedAt, to: (r: Injury) => r.firstAssessment },
  { key: "assessment_to_treatment", label: "Assessment → treatment", from: (r: Injury) => r.firstAssessment, to: (r: Injury) => r.firstTreatment },
  { key: "treatment_to_rehab", label: "Treatment → rehabilitation", from: (r: Injury) => r.firstTreatment, to: (r: Injury) => r.rehabStart },
  { key: "injury_to_recovery", label: "Injury → recovery", from: (r: Injury) => r.date, to: (r: Injury) => r.resolvedAt },
] as const;

export function intervalStats(rows: Injury[], i: (typeof TIMELINESS)[number], thresholdDays: number | null) {
  const values = rows.map((r) => (r.dateRecorded || i.key !== "injury_to_report" ? daysBetween(i.from(r), i.to(r)) : null)).filter((d): d is number => d != null);
  return {
    label: i.label, key: i.key, n: values.length, missing: rows.length - values.length, mean: avg(values), median: median(values),
    min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
    prompt: thresholdDays == null ? null : values.filter((v) => v <= thresholdDays).length,
    delayed: thresholdDays == null ? null : values.filter((v) => v > thresholdDays).length,
  };
}

export function histogram(values: number[], edges = [0, 1, 3, 7, 14, 28, 56, 90]) {
  return edges.map((lo, idx) => {
    const hi = edges[idx + 1];
    return { name: hi == null ? `${lo}+ d` : `${lo}–${hi - 1} d`, value: values.filter((v) => v >= lo && (hi == null || v < hi)).length };
  });
}

/** Cases far above the recorded spread (Q3 + 1.5×IQR). Statistical outlier flag only — not a clinical judgement. */
export function prolongedCutoff(values: number[]): number | null {
  if (values.length < MIN_SAMPLE) return null;
  const s = [...values].sort((a, b) => a - b), q = (p: number) => s[Math.floor((s.length - 1) * p)]!;
  return q(0.75) + 1.5 * (q(0.75) - q(0.25));
}

export function sampleNote(n: number): string | null {
  if (n === 0) return "No recorded injuries match the current filters.";
  if (n < MIN_SAMPLE) return `Insufficient data: only ${n} record${n === 1 ? "" : "s"} — patterns are not reliable below ${MIN_SAMPLE}.`;
  return null;
}

export function pseudonymiser() {
  const map = new Map<string, string>();
  return (id: string) => {
    if (!map.has(id)) map.set(id, `ATH-${String(map.size + 1).padStart(4, "0")}`);
    return map.get(id)!;
  };
}
