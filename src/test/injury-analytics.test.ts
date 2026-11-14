import { describe, expect, it } from "vitest";
import {
  ageGroup,
  detectPatterns,
  filterRecords,
  needsFollowUp,
  parseAthleteCsv,
  summarize,
  type InjuryRecord,
} from "@/lib/injury-analytics";
import { institutionPermissions } from "@/lib/institution";

const NOW = new Date("2026-11-13T12:00:00Z");
let n = 0;
function rec(p: Partial<InjuryRecord>): InjuryRecord {
  n++;
  return {
    id: `i${n}`, injury_code: `C${n}`, athlete_id: `a${n}`, athlete_name: "A", sport: "Football", gender: null, date_of_birth: null,
    team_ids: [], body_region: "Ankle", injury_type: null, severity: "moderate", mechanism_category: null, activity_context: "training",
    onset_type: null, is_recurrence: false, injury_date: "2026-11-01", resolved_at: null, days_lost: null, status: "new",
    created_at: "2026-11-01", assessed: true, rehab_phase: null, target_return_date: null, last_review_date: "2026-11-10", ...p,
  };
}

describe("injury pattern detection", () => {
  it("flags three ankle injuries in one team within 90 days", () => {
    const rs = [rec({ team_ids: ["t1"], injury_date: "2026-10-01" }), rec({ team_ids: ["t1"], injury_date: "2026-10-20" }), rec({ team_ids: ["t1"], injury_date: "2026-11-05" })];
    const ps = detectPatterns(rs, { now: NOW, teams: new Map([["t1", "U17 Football"]]) });
    const cluster = ps.find((p) => p.kind === "cluster");
    expect(cluster?.title).toBe("Repeated ankle injuries in U17 Football");
    expect(cluster?.recordIds).toHaveLength(3);
    expect(cluster?.level).toBe("watch");
    expect(ps.filter((p) => p.kind === "cluster")).toHaveLength(1); // same injuries are not reported again for the sport
  });

  it("does not flag two injuries", () => {
    const rs = [rec({ team_ids: ["t1"] }), rec({ team_ids: ["t1"] })];
    expect(detectPatterns(rs, { now: NOW }).filter((p) => p.kind === "cluster")).toHaveLength(0);
  });

  it("ignores injuries older than the 90-day window for clusters", () => {
    const rs = [1, 2, 3].map(() => rec({ team_ids: ["t1"], injury_date: "2026-06-01" }));
    expect(detectPatterns(rs, { now: NOW }).some((p) => p.kind === "cluster")).toBe(false);
  });

  it("detects a doubling of knee injuries versus the previous 90 days", () => {
    const rs = [
      rec({ body_region: "Knee", sport: null, injury_date: "2026-07-01" }),
      ...[1, 2, 3].map(() => rec({ body_region: "Knee", sport: null, injury_date: "2026-10-15" })),
    ];
    const rise = detectPatterns(rs, { now: NOW }).find((p) => p.kind === "rise");
    expect(rise?.title).toBe("Increase in knee injuries");
    expect(rise?.stats).toContain("Previous period: 1");
  });

  it("detects athletes returning with the same injury and recommends referral", () => {
    const rs = [rec({ athlete_id: "x", injury_date: "2026-03-01" }), rec({ athlete_id: "x", injury_date: "2026-10-01" })];
    const p = detectPatterns(rs, { now: NOW }).find((q) => q.kind === "repeat");
    expect(p?.stats[0]).toBe("1 athlete");
    expect(p?.recommendations).toContain("Refer affected athletes for professional assessment");
  });

  it("flags rehabilitation far longer than similar injuries", () => {
    const resolved = [10, 12, 14].map((d) => rec({ status: "recovered", injury_date: "2026-08-01", resolved_at: `2026-08-${String(1 + d).padStart(2, "0")}` }));
    const slow = rec({ injury_date: "2026-09-01", status: "assessed" });
    const p = detectPatterns([...resolved, slow], { now: NOW }).find((q) => q.kind === "long_rehab");
    expect(p?.recordIds).toEqual([slow.id]);
  });
});

describe("institution statistics", () => {
  it("counts athletes by participation status from real rows", () => {
    const s = summarize([], [
      { id: "1", active_injuries: 0, total_injuries: 0, rehab_phase: null, created_at: "" },
      { id: "2", active_injuries: 1, total_injuries: 1, rehab_phase: "Phase 2", created_at: "" },
      { id: "3", active_injuries: 0, total_injuries: 2, rehab_phase: null, created_at: "" },
    ], NOW);
    expect([s.totalAthletes, s.activeAthletes, s.injuredAthletes, s.inRehabilitation, s.recoveredAthletes]).toEqual([3, 2, 1, 1, 1]);
  });

  it("filters by date range, severity and recovery status", () => {
    const rs = [rec({ injury_date: "2026-01-05", severity: "severe" }), rec({ injury_date: "2026-10-05", status: "recovered" })];
    expect(filterRecords(rs, { from: "2026-06-01" })).toHaveLength(1);
    expect(filterRecords(rs, { severity: "Severe" })).toHaveLength(1);
    expect(filterRecords(rs, { status: "active" })[0]?.injury_date).toBe("2026-01-05");
  });

  it("lists unassessed or overdue open injuries for follow-up", () => {
    const rs = [rec({ assessed: false }), rec({ last_review_date: "2026-10-01" }), rec({ last_review_date: "2026-11-10" }), rec({ status: "recovered", assessed: false })];
    expect(needsFollowUp(rs, NOW)).toHaveLength(2);
  });

  it("groups ages at the injury date", () => {
    expect(ageGroup("2010-12-01", "2026-11-13")).toBe("13–15");
    expect(ageGroup(null, "2026-11-13")).toBe("Age not recorded");
  });
});

describe("bulk athlete import", () => {
  it("maps common headers and rejects rows without names", () => {
    const { rows, errors } = parseAthleteCsv('First name,Surname,Sport,DOB\nJane,Akello,Netball,2011-02-03\n,Okello,Football,\n"Mary, Ann",Nambi,,03/02/2011');
    expect(rows).toEqual([
      { first_name: "Jane", surname: "Akello", sport: "Netball", date_of_birth: "2011-02-03" },
      { first_name: "Mary, Ann", surname: "Nambi" },
    ]);
    expect(errors).toHaveLength(2);
  });
});

describe("institution permissions", () => {
  it("lets only administrators manage athletes, teams, consent and institution-wide messages", () => {
    const coach = institutionPermissions("coach");
    expect([coach.manageAthletes, coach.manageTeams, coach.recordConsent, coach.messageEveryone]).toEqual([false, false, false, false]);
    expect([coach.reportInjury, coach.referAthletes, coach.messageTeams]).toEqual([true, true, true]);
    expect(institutionPermissions("school_admin").recordConsent).toBe(true);
  });
});
