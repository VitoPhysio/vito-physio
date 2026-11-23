import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  MessageCircle,
  Phone,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/vito/SimpleForm";
import { emailConsultationConfirmation } from "@/lib/consultation.functions";

export type ConsultationMode = "physical" | "phone" | "google_meet" | "whatsapp_call";
type ConsultationStatus = "new" | "in_progress" | "confirmed" | "completed" | "closed";
const MODES: { value: ConsultationMode; label: string }[] = [
  { value: "physical", label: "In person" },
  { value: "phone", label: "Phone call" },
  { value: "google_meet", label: "Google Meet" },
  { value: "whatsapp_call", label: "WhatsApp call" },
];
const modeLabel = (value: string | null) =>
  MODES.find((m) => m.value === value)?.label ?? "Not confirmed";
const modeIcon = (value: string | null) =>
  value === "physical"
    ? MapPin
    : value === "google_meet"
      ? Video
      : value === "phone"
        ? Phone
        : MessageCircle;
const localDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const calendarUrl = (name: string, dateTime: string) => {
  const start = dateTime ? new Date(dateTime).toISOString() : "";
  const end = dateTime ? new Date(new Date(dateTime).getTime() + 45 * 60_000).toISOString() : "";
  const toCalendarDate = (value: string) => value.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `VITO consultation with ${name}`,
  });
  if (start) params.set("dates", `${toCalendarDate(start)}/${toCalendarDate(end)}`);
  params.set(
    "details",
    "Schedule the consultation, enable Google Meet, then copy the meeting link back into the VITO consultation workspace.",
  );
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
const statusLabel: Record<ConsultationStatus, string> = {
  new: "Open",
  in_progress: "In progress",
  confirmed: "Confirmed",
  completed: "Successful",
  closed: "Closed",
};

export function ConsultationWorkspace({
  userId,
  focusRequestId,
}: {
  userId: string;
  focusRequestId?: string | undefined;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sendConfirmation = useServerFn(emailConsultationConfirmation);
  const [filter, setFilter] = useState<"all" | ConsultationStatus>("all");
  const [mode, setMode] = useState<Record<string, ConsultationMode>>({});
  const [when, setWhen] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["consultation-requests", "staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_requests")
        .select(
          "id, contact_name, email, phone, organisation_type, message, status, created_at, preferred_mode, preferred_details, assigned_to, claimed_at, accepted_mode, scheduled_at, meeting_details, completed_at, requester_user_id",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = [...new Set((data ?? []).flatMap((r) => (r.assigned_to ? [r.assigned_to] : [])))];
      const names = ids.length
        ? await supabase.rpc("get_sender_names", { _ids: ids })
        : { data: [], error: null };
      if (names.error) throw names.error;
      const people = new Map(
        (names.data ?? []).map((person) => [person.id, person.full_name ?? "VITO clinician"]),
      );
      return { rows: data ?? [], people };
    },
    staleTime: 10_000,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["consultation-requests"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  useEffect(() => {
    if (!focusRequestId || query.isLoading) return;
    window.setTimeout(
      () =>
        document
          .getElementById(`consultation-${focusRequestId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      80,
    );
  }, [focusRequestId, query.isLoading, query.data]);
  const rows = query.data?.rows ?? [];
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const counts = {
    open: rows.filter((row) => row.status === "new").length,
    active: rows.filter((row) => row.status === "in_progress" || row.status === "confirmed").length,
    successful: rows.filter((row) => row.status === "completed").length,
    closed: rows.filter((row) => row.status === "closed").length,
  };

  async function claim(id: string) {
    const { data, error } = await supabase.rpc("claim_consultation_request", { _id: id });
    if (error || !data)
      return void toast.error(
        error?.message ?? "Another staff member has already claimed this request.",
      );
    toast.success("Consultation assigned to you. Other clinicians can no longer work on it.");
    refresh();
  }
  async function confirm(row: (typeof rows)[number]) {
    const accepted =
      mode[row.id] ??
      (row.accepted_mode as ConsultationMode | null) ??
      (row.preferred_mode as ConsultationMode);
    const scheduled = when[row.id] ?? localDateTime(row.scheduled_at);
    const detail = (details[row.id] ?? row.meeting_details ?? "").trim();
    if (!scheduled || !detail)
      return void toast.error("Add the confirmed date/time and meeting details first.");
    const { error } = await supabase.rpc("confirm_consultation_meeting", {
      _id: row.id,
      _accepted_mode: accepted,
      _scheduled_at: new Date(scheduled).toISOString(),
      _meeting_details: detail,
    });
    if (error) return void toast.error(error.message);
    try {
      const delivery = await sendConfirmation({ data: { id: row.id } });
      if (delivery.status === "sent") {
        toast.success("Meeting confirmed and emailed to the requester.");
      } else if (delivery.status === "skipped") {
        toast.warning(
          "Meeting confirmed in the workspace; email was skipped because Gmail SMTP is not configured. The requester can still see the details in their dashboard.",
        );
      } else {
        toast.error(
          "Meeting confirmed in the workspace, but email delivery failed. Check the delivery log; the requester can still see the details in their dashboard.",
        );
      }
    } catch {
      toast.error(
        "Meeting confirmed in the workspace, but the email attempt failed unexpectedly. The requester can still see the details in their dashboard.",
      );
    }
    refresh();
  }
  async function finish(id: string) {
    const { error } = await supabase.rpc("complete_consultation_request", { _id: id });
    if (error) return void toast.error(error.message);
    toast.success("Consultation recorded as successfully completed.");
    refresh();
  }
  async function close(id: string) {
    const { error } = await supabase.rpc("close_consultation_request", { _id: id });
    if (error) return void toast.error(error.message);
    toast.success("Request closed.");
    refresh();
  }
  async function messageRequester(other: string) {
    const { data, error } = await supabase.rpc("create_workspace_conversation", {
      _other_user: other,
    });
    if (error || !data)
      return void toast.error(error?.message ?? "Could not open the Workspace conversation.");
    await navigate({ to: "/messages", search: { conversation: data, box: "workspace" } });
  }

  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading consultation requests…</p>;
  if (query.error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
      >
        Consultation requests could not be loaded.{" "}
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Open" value={counts.open} />
        <Metric label="Being handled" value={counts.active} />
        <Metric label="Successful" value={counts.successful} />
        <Metric label="Closed" value={counts.closed} />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filter consultation requests">
        {(["all", "new", "in_progress", "confirmed", "completed", "closed"] as const).map(
          (value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? `All (${rows.length})`
                : `${statusLabel[value]} (${rows.filter((r) => r.status === value).length})`}
            </Button>
          ),
        )}
      </div>
      {!visible.length ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "consultation" : statusLabel[filter].toLowerCase()} requests.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => {
            const isMine = row.assigned_to === userId;
            const isNew = row.status === "new";
            const active = row.status === "in_progress" || row.status === "confirmed";
            const Icon = modeIcon(row.accepted_mode ?? row.preferred_mode);
            return (
              <li
                id={`consultation-${row.id}`}
                key={row.id}
                className={`rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${focusRequestId === row.id ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{row.contact_name}</h3>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                        {statusLabel[row.status as ConsultationStatus] ?? row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.organisation_type} · {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.requester_user_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void messageRequester(row.requester_user_id!)}
                      >
                        Message requester
                      </Button>
                    )}
                    {isNew && (
                      <Button size="sm" onClick={() => void claim(row.id)}>
                        Claim & work on request
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p>
                      <a className="text-primary underline" href={`mailto:${row.email}`}>
                        {row.email}
                      </a>
                    </p>
                    {row.phone && (
                      <p>
                        <a className="text-primary underline" href={`tel:${row.phone}`}>
                          {row.phone}
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Requested meeting
                    </p>
                    <p className="mt-1 font-semibold">{modeLabel(row.preferred_mode)}</p>
                    {row.preferred_details && (
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {row.preferred_details}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{row.message}</p>
                {row.assigned_to && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Assigned to{" "}
                    {row.assigned_to === userId
                      ? "you"
                      : (query.data?.people.get(row.assigned_to) ?? "a VITO clinician")}
                    {row.claimed_at
                      ? ` · claimed ${new Date(row.claimed_at).toLocaleString()}`
                      : ""}
                  </p>
                )}
                {row.accepted_mode && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 text-primary" /> Confirmed:{" "}
                      {modeLabel(row.accepted_mode)}
                    </p>
                    {row.scheduled_at && (
                      <p className="mt-1">{new Date(row.scheduled_at).toLocaleString()}</p>
                    )}
                    {row.meeting_details && (
                      <p className="mt-1 break-words text-muted-foreground">
                        {row.meeting_details}
                      </p>
                    )}
                  </div>
                )}
                {isMine && active && (
                  <div className="mt-4 space-y-3 rounded-xl border p-3">
                    <p className="text-sm font-semibold">Confirm the meeting with the requester</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`accepted-${row.id}`}>Accepted mode</Label>
                        <select
                          id={`accepted-${row.id}`}
                          className={`${selectClass} mt-1`}
                          value={mode[row.id] ?? row.accepted_mode ?? row.preferred_mode}
                          onChange={(event) =>
                            setMode({ ...mode, [row.id]: event.target.value as ConsultationMode })
                          }
                        >
                          {MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        {(mode[row.id] ?? row.accepted_mode ?? row.preferred_mode) ===
                          "google_meet" && (
                          <a
                            className="mt-2 inline-flex text-sm font-medium text-primary underline"
                            href={calendarUrl(
                              row.contact_name,
                              when[row.id] ?? localDateTime(row.scheduled_at),
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Google Calendar to schedule Meet
                          </a>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`scheduled-${row.id}`}>Confirmed date & time</Label>
                        <Input
                          id={`scheduled-${row.id}`}
                          type="datetime-local"
                          className="mt-1"
                          value={when[row.id] ?? localDateTime(row.scheduled_at)}
                          onChange={(event) => setWhen({ ...when, [row.id]: event.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`details-${row.id}`}>
                        {(mode[row.id] ?? row.accepted_mode ?? row.preferred_mode) === "physical"
                          ? "Clinic / meeting location"
                          : (mode[row.id] ?? row.accepted_mode ?? row.preferred_mode) ===
                              "google_meet"
                            ? "Google Meet link"
                            : (mode[row.id] ?? row.accepted_mode ?? row.preferred_mode) ===
                                "whatsapp_call"
                              ? "WhatsApp number to share"
                              : "Phone number for the call"}
                      </Label>
                      <Input
                        id={`details-${row.id}`}
                        maxLength={500}
                        className="mt-1"
                        placeholder={
                          (mode[row.id] ?? row.accepted_mode ?? row.preferred_mode) ===
                          "google_meet"
                            ? "https://meet.google.com/..."
                            : "Add the confirmed location or contact details"
                        }
                        value={details[row.id] ?? row.meeting_details ?? ""}
                        onChange={(event) =>
                          setDetails({ ...details, [row.id]: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void confirm(row)}>
                        Confirm meeting & notify requester
                      </Button>
                      {row.status === "confirmed" && (
                        <Button size="sm" variant="outline" onClick={() => void finish(row.id)}>
                          <CheckCircle2 className="mr-1 size-4" />
                          Mark successful
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => void close(row.id)}>
                        Close request
                      </Button>
                    </div>
                  </div>
                )}
                {row.status === "confirmed" && !isMine && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Only the assigned clinician can update this confirmed consultation.
                  </p>
                )}
                {row.status === "completed" && row.completed_at && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Completed {new Date(row.completed_at).toLocaleString()}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black text-primary">{value}</p>
    </div>
  );
}

export function AthleteConsultations({ user, contactName }: { user: User; contactName: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [preferredMode, setPreferredMode] = useState<ConsultationMode>("physical");
  const [phone, setPhone] = useState("");
  const [preferredDetails, setPreferredDetails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["consultation-requests", "athlete", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_requests")
        .select(
          "id, contact_name, email, phone, organisation_type, message, status, created_at, preferred_mode, preferred_details, accepted_mode, scheduled_at, meeting_details, completed_at",
        )
        .eq("requester_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  async function submit() {
    if (message.trim().length < 10)
      return void toast.error("Please describe what you need (at least 10 characters).");
    if (preferredMode === "physical" && !preferredDetails.trim())
      return void toast.error("Add a preferred location or access details.");
    setBusy(true);
    const { error } = await supabase.from("consultation_requests").insert({
      requester_user_id: user.id,
      contact_name: contactName || user.email || "Athlete",
      email: user.email ?? "",
      phone: phone.trim() || null,
      organisation_type: "individual",
      message: message.trim(),
      preferred_mode: preferredMode,
      preferred_details: preferredDetails.trim() || null,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Consultation request sent to the VITO team.");
    setMessage("");
    setPhone("");
    setPreferredDetails("");
    setPreferredMode("physical");
    setShowForm(false);
    void qc.invalidateQueries({ queryKey: ["consultation-requests", "athlete", user.id] });
  }
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        Your consultation requests could not be loaded.
      </p>
    );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Consultation requests</h3>
          <p className="text-sm text-muted-foreground">
            Track your request and view confirmed meeting details here.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((value) => !value)}>
          {showForm ? "Cancel" : "Request a consultation"}
        </Button>
      </div>
      {showForm && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="athlete-consult-mode">Preferred meeting mode</Label>
              <select
                id="athlete-consult-mode"
                className={`${selectClass} mt-1`}
                value={preferredMode}
                onChange={(event) => setPreferredMode(event.target.value as ConsultationMode)}
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="athlete-consult-phone">Phone / WhatsApp number</Label>
              <Input
                id="athlete-consult-phone"
                className="mt-1"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={40}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="athlete-consult-details">
              {preferredMode === "physical"
                ? "Preferred location or access details"
                : preferredMode === "google_meet"
                  ? "Google Meet preferences (optional)"
                  : "Best number or contact details (optional)"}
            </Label>
            <Input
              id="athlete-consult-details"
              className="mt-1"
              value={preferredDetails}
              onChange={(event) => setPreferredDetails(event.target.value)}
              maxLength={500}
            />
          </div>
          <div>
            <Label htmlFor="athlete-consult-message">How can we help?</Label>
            <Textarea
              id="athlete-consult-message"
              className="mt-1"
              rows={3}
              maxLength={2000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Sending…" : "Send consultation request"}
          </Button>
        </div>
      )}
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your consultations…</p>
      ) : query.data?.length ? (
        <ul className="space-y-3">
          {query.data.map((row) => {
            const Icon = modeIcon(row.accepted_mode ?? row.preferred_mode);
            return (
              <li key={row.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">VITO consultation</p>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                    {statusLabel[row.status as ConsultationStatus] ?? row.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Requested {new Date(row.created_at).toLocaleString()} · Preferred:{" "}
                  {modeLabel(row.preferred_mode)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{row.message}</p>
                {row.accepted_mode && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 text-primary" />
                      {modeLabel(row.accepted_mode)} confirmed
                    </p>
                    {row.scheduled_at && (
                      <p className="mt-1 flex items-center gap-2">
                        <CalendarClock className="size-4" />
                        {new Date(row.scheduled_at).toLocaleString()}
                      </p>
                    )}
                    {row.meeting_details &&
                      (row.accepted_mode === "google_meet" ? (
                        <p className="mt-1">
                          <a
                            className="break-all text-primary underline"
                            href={row.meeting_details}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Google Meet
                          </a>
                        </p>
                      ) : (
                        <p className="mt-1 break-words">{row.meeting_details}</p>
                      ))}
                  </div>
                )}
                {row.status === "completed" && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="size-4" />
                    Marked successful by your clinician
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          <ClipboardList className="mb-2 size-5 text-primary" />
          No VITO consultation requests yet.
        </div>
      )}
    </section>
  );
}
