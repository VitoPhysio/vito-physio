import { describe, expect, it } from "vitest";
import { groupCases } from "@/lib/case-organisation";
import { CASE_EDIT_FIELDS, caseEditInitial, caseEditPayload } from "@/lib/case-editing";

const rows = [
  { id: "old", status: "new", created_at: "2026-10-01T00:00:00Z", athletes: { first_name: "Alice", surname: "Zebra" } },
  { id: "recent", status: "new", created_at: "2026-10-25T00:00:00Z", athletes: { first_name: "Brian", surname: "Able" } },
  { id: "rehab", status: "in rehab", created_at: "2026-10-20T00:00:00Z", athletes: { first_name: "Clara", surname: "Smith" } },
];
describe("case organisation and editing", () => {
  it("groups cases by status", () => {
    const groups = groupCases(rows, "newest");
    expect(groups.map((group) => [group.status, group.cases.length])).toEqual([["new", 2], ["in rehab", 1]]);
  });
  it("orders each status group by novelty", () => {
    expect(groupCases(rows, "newest")[0]?.cases.map((row) => row.id)).toEqual(["recent", "old"]);
    expect(rows[0]?.id).toBe("old");
  });
  it("orders by athlete name alphabetically", () => {
    expect(groupCases(rows, "alphabetical")[0]?.cases.map((row) => row.id)).toEqual(["old", "recent"]);
  });
  it("loads saved opening information including blank fields", () => {
    const initial = caseEditInitial("injuries", { body_region: "Knee", pain_score: 0, notes: null });
    expect(initial["body_region"]).toBe("Knee");
    expect(initial["pain_score"]).toBe("0");
    expect(initial["notes"]).toBe("");
  });
  it("edits only case opening fields, preserving identity and status", () => {
    const payload = caseEditPayload("injuries", { body_region: " Ankle ", pain_score: "4", notes: "", id: "other", athlete_id: "other", created_by: "other", status: "recovered" });
    expect(payload.body_region).toBe("Ankle");
    expect(payload.pain_score).toBe(4);
    expect(payload.notes).toBeNull();
    expect(payload).not.toHaveProperty("athlete_id");
    expect(payload).not.toHaveProperty("created_by");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("id");
  });
  it("edits saved assessment details without creating a new identity", () => {
    expect(caseEditPayload("assessments", { clinical_impression: "Improving", id: "new" })).toMatchObject({ clinical_impression: "Improving" });
    expect(caseEditPayload("assessments", { clinical_impression: "Improving", id: "new" })).not.toHaveProperty("id");
  });
  it("preserves historical recovery status while allowing note corrections", () => {
    expect(caseEditPayload("recovery_updates", { notes: "Corrected note", status: "recovered" })).toEqual({ notes: "Corrected note" });
  });
  it("rejects pain scores outside the existing 0–10 range", () => {
    expect(() => caseEditPayload("injuries", { body_region: "Knee", pain_score: "11" })).toThrow();
  });
  it("requires the opening body region", () => {
    expect(() => caseEditPayload("injuries", { body_region: " " })).toThrow();
  });
  it("keeps appointment date and time when reopening and saving", () => {
    const initial = caseEditInitial("appointments", { scheduled_at: "2026-10-25T10:00:00.000Z", status: "scheduled" });
    expect(caseEditPayload("appointments", initial).scheduled_at).toBe("2026-10-25T10:00:00.000Z");
  });
  it("keeps unfamiliar statuses visible instead of dropping their cases", () => {
    expect(groupCases([{ ...rows[0], id: "custom", status: "awaiting review", created_at: "2026-10-26T00:00:00Z" }], "newest").map((group) => group.status)).toEqual(["awaiting review"]);
  });
  it("preserves record links and ownership for every editable management table", () => {
    for (const table of Object.keys(CASE_EDIT_FIELDS) as (keyof typeof CASE_EDIT_FIELDS)[]) {
      const values = Object.fromEntries(CASE_EDIT_FIELDS[table].map((field) => [field.name, field.options?.[0]?.value ?? (field.type === "datetime-local" ? "2026-10-26T12:00" : field.name === "sets" || field.name === "pain_score" ? "3" : "Corrected")]));
      const payload = caseEditPayload(table, { ...values, id: "replaced", athlete_id: "replaced", injury_id: "replaced", plan_id: "replaced", created_by: "replaced" });
      for (const key of ["id", "athlete_id", "injury_id", "plan_id", "created_by"]) expect(payload).not.toHaveProperty(key);
    }
  });
});