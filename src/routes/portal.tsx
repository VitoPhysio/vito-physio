import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { WhatsAppConsultationButton } from "@/components/vito/WhatsAppConsultationButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findPortalRecord, requestConsent } from "@/lib/intake.functions";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Parent portal — VITO Physio" },
      {
        name: "description",
        content:
          "Use an athlete ID and surname to view their rehabilitation plans and appointments.",
      },
      { property: "og:title", content: "Parent portal — VITO Physio" },
      {
        property: "og:description",
        content: "View rehabilitation plans and appointments with verified athlete details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Portal,
});
type RecordView = Awaited<ReturnType<typeof findPortalRecord>>;
function Portal() {
  const [record, setRecord] = useState<RecordView>(null);
  const [code, setCode] = useState("");
  const [surname, setSurname] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function lookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setRecord(null);
    try {
      const found = await findPortalRecord({ data: { code, surname } });
      if (found) setRecord(found);
      else setMessage("No matching athlete was found. Check the ID and surname.");
    } catch {
      setMessage("Could not look up this athlete. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function consent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    try {
      const fd = new FormData(form);
      const result = await requestConsent({
        data: {
          code,
          surname,
          requester_name: String(fd.get("name")),
          requester_email: String(fd.get("email")),
        },
      });
      setMessage(
        result.ok
          ? "Consent form request saved for the VITO team."
          : "Could not verify this athlete.",
      );
      if (result.ok) form.reset();
    } catch {
      setMessage("Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed bottom-5 right-5 z-40">
        <WhatsAppConsultationButton compact />
      </div>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <h1 className="text-xl font-bold text-primary">VITO Physio</h1>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 size-4" /> Home
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-9">
        <div>
          <h2 className="text-3xl font-bold">Parent portal</h2>
          <p className="mt-2 text-muted-foreground">
            Enter the athlete ID and surname supplied at registration.
          </p>
        </div>
        <form onSubmit={lookup} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="code">Athlete ID</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VITO-ATH-00000001"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="surname">Surname</Label>
            <Input
              id="surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={busy}>
            View record
          </Button>
        </form>
        {message && (
          <p role="status" className="text-sm text-primary">
            {message}
          </p>
        )}
        {record && (
          <div className="space-y-8">
            <div className="border-b pb-4">
              <p className="text-xs font-semibold uppercase text-accent">Verified athlete</p>
              <h3 className="text-2xl font-bold">
                {record.athlete.first_name}{" "}
                <span className="text-muted-foreground">· {record.athlete.athlete_code}</span>
              </h3>
            </div>
            <section>
              <h3 className="mb-3 text-lg font-semibold">Rehabilitation plans</h3>
              {record.plans.length ? (
                <ul className="divide-y border-y">
                  {record.plans.map((p, i) => (
                    <li key={i} className="py-3">
                      <p className="font-medium">
                        {p.phase || "Plan"}{" "}
                        {p.target_return_date ? `· target ${p.target_return_date}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">{p.goals}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No plans on record.</p>
              )}
            </section>
            <section>
              <h3 className="mb-3 text-lg font-semibold">Appointments</h3>
              {record.appointments.length ? (
                <ul className="divide-y border-y">
                  {record.appointments.map((a, i) => (
                    <li key={i} className="py-3">
                      <p className="font-medium">
                        {new Date(a.scheduled_at).toLocaleString()} · {a.status}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {a.purpose} {a.location ? `· ${a.location}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No appointments on record.</p>
              )}
            </section>
            <section className="border-t pt-6">
              <h3 className="mb-3 text-lg font-semibold">Request a consent form</h3>
              <form onSubmit={consent} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" name="name" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" name="email" type="email" required className="mt-1" />
                </div>
                <Button type="submit" disabled={busy}>
                  Request consent form
                </Button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
