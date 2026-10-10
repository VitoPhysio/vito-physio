import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock3, Mail, MessageCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhotoAvatar } from "@/components/vito/Photo";
import { JoinRequests, AthleteRegistry } from "@/components/vito/AdminRegistry";
import {
  listAccounts,
  listDeliveryLogs,
  sendAdminEmail,
  approveAccount,
  removeAccount,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Accounts & approvals — VITO Physio" },
      { name: "description", content: "Review and manage registered VITO Physio accounts." },
      { property: "og:title", content: "Accounts & approvals — VITO Physio" },
      { property: "og:description", content: "Review and manage registered VITO Physio accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const LABEL: Record<string, string> = {
  super_admin: "Super admin",
  vito_admin: "VITO admin",
  clinical_professional: "Clinician",
  clinical_supervisor: "Clinical supervisor",
  school_admin: "School / club admin",
  coach: "Coach",
  athlete: "Athlete",
  parent: "Parent / guardian",
};

function DeliveryStatusPanel({
  delivery,
}: {
  delivery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listDeliveryLogs>>>>;
}) {
  const summary = delivery.data?.summary;
  const statusStyle = (status: string) =>
    status === "sent"
      ? "bg-emerald-100 text-emerald-800"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  const StatusIcon = (status: string) =>
    status === "sent" ? CheckCircle2 : status === "failed" ? XCircle : Clock3;
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Alert delivery status</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent email and WhatsApp delivery results for consultation and inquiry alerts.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => delivery.refetch()}>
          Refresh
        </Button>
      </div>
      {delivery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading delivery status…</p>
      ) : delivery.error ? (
        <p className="text-sm text-destructive">
          Delivery logs are not available yet. Apply the delivery-log migration to enable
          monitoring.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Sent" value={summary?.sent ?? 0} tone="text-emerald-700" />
            <Metric label="Failed" value={summary?.failed ?? 0} tone="text-red-700" />
            <Metric label="Skipped" value={summary?.skipped ?? 0} tone="text-amber-700" />
            <Metric label="Tracked" value={summary?.total ?? 0} tone="text-primary" />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border bg-background p-3 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <Mail className="size-4 text-primary" />
                Email alerts
              </span>
              <p className="mt-1 text-muted-foreground">{summary?.email ?? 0} recent records</p>
            </div>
            <div className="rounded-xl border bg-background p-3 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <MessageCircle className="size-4 text-[#128C7E]" />
                WhatsApp alerts
              </span>
              <p className="mt-1 text-muted-foreground">{summary?.whatsapp ?? 0} recent records</p>
            </div>
          </div>
          {delivery.data?.logs.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Channel</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Request</th>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.data.logs.map((log) => {
                    const Icon = StatusIcon(log.status);
                    return (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="px-2 py-3 font-medium capitalize">{log.channel}</td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusStyle(log.status)}`}
                          >
                            <Icon className="size-3" />
                            {log.status}
                          </span>
                        </td>
                        <td className="px-2 py-3 font-mono text-xs">
                          {log.consultation_request_id.slice(0, 8)}…
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="max-w-xs truncate px-2 py-3 text-muted-foreground">
                          {log.error_message ||
                            log.provider_message_id ||
                            "Delivered without provider reference"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              No delivery attempts have been recorded yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

type AdminRecipient = { id: string; full_name: string | null; email: string | null; role: string };

function AdminEmailComposer({
  accounts,
  send,
}: {
  accounts: AdminRecipient[];
  send: (args: any) => Promise<{ total: number; sent: number; failed: number; skipped: number }>;
}) {
  const [audience, setAudience] = useState("selected");
  const [selected, setSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const recipients = accounts.filter((account) => account.email);
  const toggleRecipient = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (audience === "selected" && !selected.length) {
      toast.error("Select at least one recipient.");
      return;
    }
    setBusy(true);
    try {
      const result = await send({
        data: { audience, recipientIds: audience === "selected" ? selected : [], subject, message },
      });
      toast.success(
        `Email processed for ${result.total} recipient${result.total === 1 ? "" : "s"}: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped.`,
      );
      setSubject("");
      setMessage("");
      setSelected([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email could not be sent.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Send email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a private message to selected users or a broadcast to a role-based audience. Every
          recipient is tracked in delivery status.
        </p>
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Audience
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="selected">Selected users</option>
              <option value="all">Everyone with an email</option>
              <option value="staff">All staff</option>
              <option value="athletes">All athletes</option>
              <option value="parents">All parents / guardians</option>
              <option value="coaches">All coaches</option>
              <option value="school_admins">All school / club admins</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Subject
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              minLength={3}
              maxLength={160}
              required
              className="mt-1"
              placeholder="Message subject"
            />
          </label>
        </div>
        {audience === "selected" && (
          <div className="rounded-xl border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">
                Choose recipients ({selected.length} selected)
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-primary underline"
                onClick={() =>
                  setSelected(
                    selected.length === recipients.length
                      ? []
                      : recipients.map((account) => account.id),
                  )
                }
              >
                {selected.length === recipients.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {recipients.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(account.id)}
                    onChange={() => toggleRecipient(account.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {account.full_name || "Unnamed user"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {account.email} · {LABEL[account.role] || account.role}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="text-sm font-medium">
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            minLength={10}
            maxLength={10000}
            required
            rows={7}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Write the email message…"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {audience === "selected"
              ? `${selected.length} recipient${selected.length === 1 ? "" : "s"} selected`
              : `Broadcast audience: ${audience.replace("_", " ")}`}
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send email"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAccounts),
    deliveryList = useServerFn(listDeliveryLogs),
    sendEmail = useServerFn(sendAdminEmail),
    approve = useServerFn(approveAccount),
    remove = useServerFn(removeAccount);
  const { data, error, isLoading } = useQuery({ queryKey: ["accounts"], queryFn: () => list() });
  const delivery = useQuery({ queryKey: ["delivery-logs"], queryFn: () => deliveryList() });
  const [q, setQ] = useState("");
  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  if (error) return <p className="p-8 text-destructive">Only VITO admins can view this page.</p>;
  if (isLoading || !data) return <p className="p-8 text-muted-foreground">Loading…</p>;
  const pending = data.accounts.filter(
    (a) => a.requested_role === "vito_admin" || a.requested_role === "clinical_professional",
  );
  const shown = data.accounts.filter((a) =>
    `${a.full_name} ${a.email} ${a.account_code} ${a.role}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <h1 className="text-xl font-bold">Accounts & approvals</h1>
          <Button asChild variant="secondary" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="mr-1 size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        <section>
          <h2 className="mb-3 text-lg font-bold">Pending staff requests ({pending.length})</h2>
          {pending.length ? (
            <ul className="space-y-2">
              {pending.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-accent bg-card p-3"
                >
                  <span className="flex items-center gap-3">
                    <PhotoAvatar path={a.avatar_path} name={a.full_name} />
                    <span>
                      <b>{a.full_name ?? "—"}</b>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {a.email} · wants {LABEL[a.requested_role!]}
                      </span>
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        run(() => approve({ data: { userId: a.id, approve: true } }), "Approved")
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(() => approve({ data: { userId: a.id, approve: false } }), "Declined")
                      }
                    >
                      Decline
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          )}
        </section>
        <JoinRequests userId={data.me} />
        <DeliveryStatusPanel delivery={delivery} />
        <AdminEmailComposer accounts={data.accounts} send={sendEmail} />
        <AthleteRegistry />
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Registered accounts ({data.accounts.length})</h2>
            <Input
              placeholder="Search name, email, ID or role"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <ul className="space-y-2">
            {shown.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm"
              >
                <span className="flex items-center gap-3">
                  <PhotoAvatar path={a.avatar_path} name={a.full_name} />
                  <span>
                    <b>{a.full_name ?? "—"}</b>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {a.email} · {a.account_code} · joined{" "}
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {LABEL[a.role] ?? a.role}
                  </span>
                  {a.id !== data.me && a.role !== "super_admin" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        confirm(`Remove ${a.email}? This cannot be undone.`) &&
                        run(() => remove({ data: { userId: a.id } }), "Account removed")
                      }
                    >
                      Remove
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
