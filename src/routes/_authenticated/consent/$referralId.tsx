import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { instRpc, Loading, LoadError } from "@/components/vito/institution/shared";
import { SHARING_SCOPES } from "@/lib/institution";

export const Route = createFileRoute("/_authenticated/consent/$referralId")({
  head: () => ({
    meta: [
      { title: "Consent to share health information — VITO Physio" },
      { name: "description", content: "Review and answer a request to share an athlete's health information with a professional." },
      { property: "og:title", content: "Consent request — VITO Physio" },
      { property: "og:description", content: "Approve or refuse sharing an athlete's information with a professional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsentPage,
});

type Details = { referral_code: string; athlete_name: string; institution: string | null; professional: string; purpose: string | null; reason: string | null; scopes: string[]; requested_by: string | null; consent_status: string; consent_name: string | null; consent_at: string | null; created_at: string };

function ConsentPage() {
  const { referralId } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["consent", referralId], queryFn: () => instRpc<Details>("referral_consent_details", { _referral: referralId }) });
  async function answer(approve: boolean) {
    setBusy(true);
    try {
      await instRpc("respond_referral_consent", { _referral: referralId, _approve: approve });
      toast.success(approve ? "Thank you — consent given" : "Sharing refused");
      void qc.invalidateQueries({ queryKey: ["consent", referralId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save your answer"); } finally { setBusy(false); }
  }
  if (q.isLoading) return <main className="p-6"><Loading what="request" /></main>;
  if (q.error || !q.data) return <main className="mx-auto max-w-lg p-6"><LoadError error={q.error} /></main>;
  const d = q.data;
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <h1 className="text-xl font-bold">Consent to share health information</h1>
      <div className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <p><b>{d.institution ?? "An institution"}</b> asks to share information about <b>{d.athlete_name}</b> with <b>{d.professional}</b>.</p>
        {d.purpose && <p>Purpose: {d.purpose}</p>}
        {d.reason && <p>Reason: {d.reason}</p>}
        <p className="font-medium">Information that would be shared:</p>
        <ul className="list-disc pl-5">
          {d.scopes.map((s) => { const sc = SHARING_SCOPES.find((x) => x.value === s); return <li key={s}>{sc?.label ?? s}{sc ? ` — ${sc.detail}` : ""}</li>; })}
        </ul>
        <p className="text-xs text-muted-foreground">Requested by {d.requested_by ?? "a staff member"} · {d.referral_code}. You can ask the institution to cancel sharing at any time.</p>
      </div>
      {d.consent_status === "pending" ? (
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => void answer(true)}>I agree to share</Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={() => void answer(false)}>Refuse</Button>
        </div>
      ) : (
        <p className="rounded-xl bg-muted p-3 text-sm">This request was {d.consent_status === "granted" ? "approved" : d.consent_status}{d.consent_name ? ` by ${d.consent_name}` : ""}{d.consent_at ? ` on ${new Date(d.consent_at).toLocaleDateString()}` : ""}.</p>
      )}
      <Button asChild variant="ghost"><Link to="/notifications">Back to notifications</Link></Button>
    </main>
  );
}
