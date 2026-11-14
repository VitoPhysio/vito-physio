import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, instRpc, Loading, LoadError, StatusPill } from "@/components/vito/institution/shared";
import { REFERRAL_STATUS_LABEL } from "@/lib/institution";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referral inbox — VITO Physio" },
      { name: "description", content: "Referrals sent to you by schools, clubs and academies, with consent-based athlete information." },
      { property: "og:title", content: "Referral inbox — VITO Physio" },
      { property: "og:description", content: "Consent-based athlete referrals for professionals on VITO Physio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralInbox,
});

type Row = { id: string; referral_code: string; athlete_name: string; institution: string | null; purpose: string | null; reason: string | null; scopes: string[]; priority: string | null; status: string; consent_status: string; feedback: string | null; created_at: string };
type Detail = Record<string, unknown> & { participation?: Record<string, unknown>; injuries?: Record<string, unknown>[]; assessments?: Record<string, unknown>[]; clinical_notes?: { note: string; created_at: string }[] };

function ReferralInbox() {
  const q = useQuery({ queryKey: ["pro-referrals"], queryFn: () => instRpc<Row[]>("professional_referrals", {}) });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-black">Referral inbox</h1>
      {q.isLoading ? <Loading what="referrals" /> : q.error ? <LoadError error={q.error} /> : !q.data?.length ? (
        <p className="text-sm text-muted-foreground">No referrals have been sent to you yet.</p>
      ) : (
        <ul className="space-y-3">
          {q.data.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{r.athlete_name} <span className="font-normal text-muted-foreground">· {r.institution}</span></p>
                <div className="flex gap-1">
                  {r.priority === "urgent" && <StatusPill tone="bad">Urgent</StatusPill>}
                  <StatusPill tone={r.consent_status === "granted" ? "good" : "warn"}>{r.consent_status === "granted" ? "Consent given" : "Awaiting consent"}</StatusPill>
                  <StatusPill tone="info">{REFERRAL_STATUS_LABEL[r.status] ?? r.status}</StatusPill>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{r.referral_code} · {fmtDate(r.created_at)}</p>
              {r.purpose && <p className="mt-1">Purpose: {r.purpose}</p>}
              {r.consent_status === "granted" && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide details" : "Open shared information"}</Button>
              )}
              {open === r.id && <ReferralDetail id={r.id} status={r.status} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ReferralDetail({ id, status }: { id: string; status: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pro-referral", id], queryFn: () => instRpc<Detail>("professional_referral_detail", { _referral: id }) });
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  async function update(s: string) {
    setBusy(true);
    try {
      await instRpc("professional_update_referral", { _referral: id, _status: s, _feedback: feedback });
      toast.success("Referral updated");
      void qc.invalidateQueries({ queryKey: ["pro-referrals"] });
      void qc.invalidateQueries({ queryKey: ["pro-referral", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); } finally { setBusy(false); }
  }
  if (q.isLoading) return <Loading what="shared information" />;
  if (q.error || !q.data) return <LoadError error={q.error} />;
  const d = q.data;
  const p = d.participation;
  const closed = ["completed", "cancelled"].includes(status);
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {d["reason"] ? <p>Reason: {String(d["reason"])}</p> : null}
      {p && <p><b>Athlete:</b> {String(p["name"])} ({String(p["athlete_code"])}) · {String(p["sport"] ?? "—")} · {String(p["competition_level"] ?? "")} · born {fmtDate(p["date_of_birth"] as string | null)}</p>}
      {d.injuries && (
        <div><b>Injuries</b>
          <ul className="list-disc pl-5">{d.injuries.map((i, k) => <li key={k}>{String(i["body_region"])} {i["injury_type"] ? `· ${String(i["injury_type"])}` : ""} · {String(i["severity"] ?? "—")} · {fmtDate(i["injury_date"] as string)} · {String(i["status"])}{i["rehab_phase"] ? ` · rehab: ${String(i["rehab_phase"])}` : ""}</li>)}</ul>
        </div>
      )}
      {d.assessments && d.assessments.length > 0 && (
        <div><b>Assessments</b>
          <ul className="list-disc pl-5">{d.assessments.map((a, k) => <li key={k}>{fmtDate(a["assessment_date"] as string | null)}: {String(a["clinical_impression"] ?? a["presenting_complaint"] ?? "—")}{a["plan"] ? ` — plan: ${String(a["plan"])}` : ""}</li>)}</ul>
        </div>
      )}
      {d.clinical_notes && d.clinical_notes.length > 0 && (
        <div><b>Clinical notes</b><ul className="list-disc pl-5">{d.clinical_notes.map((n, k) => <li key={k}>{fmtDate(n.created_at)}: {n.note}</li>)}</ul></div>
      )}
      {d["feedback"] ? <p className="rounded-md bg-muted p-2">Your feedback: {String(d["feedback"])}</p> : null}
      {!closed && (
        <div className="space-y-2">
          <Textarea placeholder="Feedback for the institution (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {status !== "accepted" && <Button size="sm" disabled={busy} onClick={() => void update("accepted")}>Accept</Button>}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void update("completed")}>Mark completed</Button>
            {status !== "accepted" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void update("declined")}>Decline</Button>}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Access to this information is recorded.</p>
    </div>
  );
}
