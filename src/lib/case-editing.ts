import type { Field } from "@/components/vito/SimpleForm";
import type { TablesUpdate } from "@/integrations/supabase/types";

export type EditableCaseTable = "injuries" | "assessments" | "rehabilitation_plans" | "exercises" | "follow_ups" | "recovery_updates" | "referrals" | "appointments" | "documents" | "clinical_notes";
const field = (name: string, label: string, type: NonNullable<Field["type"]> = "text", required = false): Field => ({ name, label, type, required });
const choices = (name: string, label: string, values: string[]): Field => ({ name, label, type: "select", options: values.map((value) => ({ value, label: value })) });
export const CASE_OPENING_FIELDS: Field[] = [field("body_region", "Body region", "text", true), field("mechanism", "Mechanism of injury"), field("injury_date", "Date of injury", "date"), field("pain_score", "Pain score (0–10)", "number"), field("sport_context", "Sport context"), field("notes", "Notes", "textarea")];
export const CASE_EDIT_FIELDS: Record<EditableCaseTable, Field[]> = {
  injuries: CASE_OPENING_FIELDS,
  assessments: [choices("assessment_type", "Assessment type", ["Initial", "Re-assessment", "Return to play", "Pre-season screening"]), field("assessment_date", "Date", "date"), ...["presenting_complaint", "history", "mechanism", "symptoms", "pain", "observation", "range_of_motion", "strength", "balance", "functional_tests", "sport_specific_findings", "red_flags", "clinical_impression", "plan", "referral_recommendation"].map((name) => field(name, name.replaceAll("_", " "), "textarea")), field("follow_up_date", "Follow-up date", "date")],
  rehabilitation_plans: [choices("phase", "Phase", ["Acute", "Sub-acute", "Strengthening", "Return to sport", "Maintenance"]), field("start_date", "Start date", "date"), field("target_return_date", "Target return date", "date"), field("goals", "Goals", "textarea", true), field("notes", "Notes", "textarea")],
  exercises: [field("name", "Exercise", "text", true), field("sets", "Sets"), field("reps", "Reps / duration"), field("frequency", "Frequency"), field("instructions", "Instructions", "textarea")],
  follow_ups: [field("review_date", "Review date", "date", true), field("pain_score", "Pain score (0–10)", "number"), field("progress", "Progress", "textarea"), field("findings", "Findings", "textarea"), field("next_steps", "Next steps", "textarea")],
  recovery_updates: [field("notes", "Notes", "textarea")],
  referrals: [field("referred_to", "Referred to", "text", true), field("reason", "Reason", "textarea"), choices("status", "Status", ["open", "completed", "cancelled"])],
  appointments: [field("scheduled_at", "Date & time", "datetime-local", true), field("location", "Location"), field("purpose", "Purpose"), choices("status", "Status", ["scheduled", "completed", "cancelled"])],
  documents: [field("title", "Document title", "text", true)],
  clinical_notes: [field("note", "Clinical note", "textarea", true)],
};

export function caseEditInitial(table: EditableCaseTable, row: Record<string, unknown>) {
  return Object.fromEntries(CASE_EDIT_FIELDS[table].map(({ name, type }) => {
    const value = row[name];
    if (type === "datetime-local" && typeof value === "string") {
      const date = new Date(value);
      if (Number.isFinite(date.getTime())) {
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
        return [name, local.toISOString().slice(0, 16)];
      }
    }
    return [name, value == null ? "" : String(value)];
  }));
}

export function caseEditPayload<T extends EditableCaseTable>(table: T, values: Record<string, string>): TablesUpdate<T> {
  const payload: Record<string, string | number | null> = {};
  for (const f of CASE_EDIT_FIELDS[table]) {
    const value = (values[f.name] ?? "").trim();
    if (f.required && !value) throw new Error(`${f.label} is required.`);
    if (value && f.options && !f.options.some((option) => option.value === value)) throw new Error(`Choose a valid ${f.label.toLowerCase()}.`);
    if (value && (f.name === "pain_score" || f.name === "sets")) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || (f.name === "pain_score" && number > 10) || (f.name === "sets" && !Number.isInteger(number))) throw new Error(`Enter a valid ${f.label.toLowerCase()}.`);
      payload[f.name] = number;
    } else if (value && f.type === "datetime-local") {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid date and time.");
      payload[f.name] = date.toISOString();
    } else payload[f.name] = value || null;
  }
  // Only the validated, whitelisted clinical fields above reach the typed client.
  return payload as TablesUpdate<T>;
}