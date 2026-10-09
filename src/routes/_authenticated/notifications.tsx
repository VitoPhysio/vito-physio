import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Dumbbell,
  FileText,
  HeartPulse,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHealth, STAGE_LABEL } from "@/components/athlete/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type NotificationData = {
  contact_name?: string;
  email?: string;
  phone?: string;
  organisation_type?: string;
  message?: string;
  sender?: string;
  sender_id?: string;
  subject?: string | null;
  audience?: string | null;
  recipient?: string | null;
  is_mine?: boolean;
  injury_id?: string;
  status?: string;
  source?: string;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
};

const ROLE_COPY: Record<
  string,
  { eyebrow: string; title: string; description: string; empty: string; icon: LucideIcon }
> = {
  athlete: {
    eyebrow: "Athlete care inbox",
    title: "Your care updates",
    description: "Recovery milestones, appointments and follow-ups in one place.",
    empty: "Your recovery updates will appear here as your care team records progress.",
    icon: Activity,
  },
  parent: {
    eyebrow: "Family care inbox",
    title: "Athlete care updates",
    description: "Stay close to the appointments, recovery milestones and follow-ups that matter.",
    empty: "Care updates for the athlete linked to your account will appear here.",
    icon: HeartPulse,
  },
  school_admin: {
    eyebrow: "School updates",
    title: "School communications",
    description: "Messages and care coordination updates connected to your school account.",
    empty: "School communications will appear here when VITO sends an update.",
    icon: FileText,
  },
  coach: {
    eyebrow: "Team updates",
    title: "Team communications",
    description: "Keep up with athlete care coordination and messages shared with coaches.",
    empty: "Team communications will appear here when VITO sends an update.",
    icon: Dumbbell,
  },
};

function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "messages" | "requests">("all");
  const { data: user } = useQuery({
    queryKey: ["notifications-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const { data: role = "athlete" } = useQuery({
    queryKey: ["notifications-role", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return roles?.[0]?.role ?? "athlete";
    },
  });
  const isCareViewer = role === "athlete" || role === "parent";
  const health = useHealth(user?.id ?? "", isCareViewer);
  const copy = ROLE_COPY[role] ?? {
    eyebrow: "VITO updates",
    title: "Notifications",
    description: "Messages and updates connected to your VITO Physio account.",
    empty: "Your VITO updates will appear here.",
    icon: Bell,
  };

  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [{ data, error }, { data: messages }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id,title,body,kind,data,read_at,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("communications")
          .select("id,sender_id,subject,body,audience,recipient_id,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (error) throw error;
      const senderIds = [
        ...new Set((messages ?? []).map((message: { sender_id: string }) => message.sender_id)),
      ];
      const { data: senders } = senderIds.length
        ? await supabase.rpc("get_sender_names", { _ids: senderIds })
        : { data: [] };
      const senderMap = new Map(
        (senders ?? []).map((sender: { id: string; full_name?: string; is_admin?: boolean }) => [
          sender.id,
          sender.is_admin ? "VITO administration (admin)" : (sender.full_name ?? "VITO clinician"),
        ]),
      );
      const communicationNotifications: NotificationRow[] = (messages ?? []).map(
        (message: {
          id: string;
          sender_id: string;
          subject?: string | null;
          body: string;
          audience?: string | null;
          recipient_id?: string | null;
          created_at: string;
        }) => ({
          id: `communication-${message.id}`,
          title: message.subject || "New communication",
          body: `${senderMap.get(message.sender_id) ?? "VITO team"} sent a communication${message.audience ? ` to ${message.audience}` : ""}.`,
          kind: "communication",
          data: {
            sender: senderMap.get(message.sender_id),
            sender_id: message.sender_id,
            subject: message.subject,
            message: message.body,
            audience: message.audience,
            recipient: message.recipient_id,
            is_mine: message.sender_id === user?.id,
          },
          read_at: null,
          created_at: message.created_at,
        }),
      );
      const notificationRows: NotificationRow[] = (data ?? []).map((notification) => ({
        ...notification,
        data:
          typeof notification.data === "object" && notification.data !== null
            ? (notification.data as NotificationData)
            : {},
      }));
      return [...notificationRows, ...communicationNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });

  const careUpdates = useMemo<NotificationRow[]>(() => {
    if (!isCareViewer || !health.data) return [];
    const h = health.data;
    const timeline = h.timeline.slice(0, 8).map((item) => ({
      id: `care-${item.id}`,
      title: item.title,
      body: "A new update has been added to your VITO care record.",
      kind: "care_update",
      data: { injury_id: item.injury_id, status: item.kind },
      read_at: null,
      created_at: item.at,
    }));
    const appointments = h.upcoming.slice(0, 5).map((appointment) => ({
      id: `appointment-${appointment.id}`,
      title: "Upcoming appointment",
      body: appointment.purpose || "You have an upcoming VITO Physio appointment.",
      kind: "appointment",
      data: { injury_id: appointment.injury_id, status: appointment.status },
      read_at: null,
      created_at: appointment.scheduled_at,
    }));
    const followUps = h.dueFollowUps.slice(0, 5).map((followUp) => ({
      id: `follow-up-${followUp.injury_id}-${followUp.date}`,
      title: followUp.source,
      body: "A follow-up review is due for your care plan.",
      kind: "follow_up",
      data: { injury_id: followUp.injury_id, source: followUp.source },
      read_at: null,
      created_at: followUp.date,
    }));
    return [...timeline, ...appointments, ...followUps].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [health.data, isCareViewer]);

  const messages = notifications.filter((notification) => notification.kind === "communication");
  const requests = notifications.filter((notification) => notification.kind !== "communication");
  const messageGroups = useMemo(() => {
    const groups = new Map<string, { sender: string; items: NotificationRow[] }>();
    for (const message of messages) {
      const key = message.data.sender_id ?? message.data.sender ?? "vito-team";
      const existing = groups.get(key);
      if (existing) existing.items.push(message);
      else groups.set(key, { sender: message.data.sender ?? "VITO team", items: [message] });
    }
    return [...groups.values()];
  }, [messages]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    await refetch();
  }

  const Icon = copy.icon;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{copy.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
          </div>
          <Icon className="size-8 text-primary" aria-hidden="true" />
        </div>

        {isCareViewer ? (
          <>
            <CareUpdatesSection
              updates={careUpdates}
              isLoading={health.isLoading}
              empty={copy.empty}
            />
            {messageGroups.length > 0 && <ConversationSection groups={messageGroups} />}
          </>
        ) : (
          <>
            {role === "super_admin" ||
            role === "vito_admin" ||
            role === "clinical_professional" ||
            role === "clinical_supervisor" ? (
              <>
                <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-sm">
                  {(
                    [
                      ["all", "All updates"],
                      ["messages", "Messages"],
                      ["requests", "Consultation requests"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={filter === value ? "default" : "ghost"}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading inbox…</p>
                ) : !notifications.length ? (
                  <EmptyState text="You are all caught up." />
                ) : (
                  <div className="space-y-6">
                    {(filter === "all" || filter === "messages") && messageGroups.length > 0 && (
                      <ConversationSection groups={messageGroups} />
                    )}
                    {(filter === "all" || filter === "requests") && requests.length > 0 && (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Bell className="size-5 text-primary" />
                          <h2 className="font-bold">Consultation requests</h2>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            {requests.length}
                          </span>
                        </div>
                        {requests.map((notification) => (
                          <RequestCard
                            key={notification.id}
                            notification={notification}
                            markRead={markRead}
                          />
                        ))}
                      </section>
                    )}
                  </div>
                )}
              </>
            ) : (
              <PersonalUpdatesSection
                notifications={notifications}
                messages={messageGroups}
                isLoading={isLoading}
                empty={copy.empty}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function CareUpdatesSection({
  updates,
  isLoading,
  empty,
}: {
  updates: NotificationRow[];
  isLoading: boolean;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <HeartPulse className="size-5 text-primary" />
        <h2 className="font-bold">Care updates</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {updates.length}
        </span>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your care updates…</p>
      ) : updates.length ? (
        updates.map((update) => <CareUpdateCard key={update.id} update={update} />)
      ) : (
        <EmptyState text={empty} />
      )}
    </section>
  );
}

function CareUpdateCard({ update }: { update: NotificationRow }) {
  const Icon =
    update.kind === "appointment" ? CalendarDays : update.kind === "follow_up" ? Check : Activity;
  return (
    <article className="rounded-2xl border border-primary/20 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold">{update.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{update.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(update.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      {update.data.status && (
        <span className="mt-4 inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
          {STAGE_LABEL[update.data.status] ?? update.data.status}
        </span>
      )}
    </article>
  );
}

function PersonalUpdatesSection({
  notifications,
  messages,
  isLoading,
  empty,
}: {
  notifications: NotificationRow[];
  messages: { sender: string; items: NotificationRow[] }[];
  isLoading: boolean;
  empty: string;
}) {
  const updates = notifications.filter((notification) => notification.kind !== "communication");
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-primary" />
          <h2 className="font-bold">Account updates</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading updates…</p>
        ) : updates.length ? (
          updates.map((notification) => (
            <article key={notification.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="font-bold">{notification.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </article>
          ))
        ) : (
          <EmptyState text={empty} />
        )}
      </section>
      {messages.length > 0 && <ConversationSection groups={messages} />}
    </div>
  );
}

function ConversationSection({
  groups,
}: {
  groups: { sender: string; items: NotificationRow[] }[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-5 text-primary" />
        <h2 className="font-bold">Messages</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {groups.reduce((count, group) => count + group.items.length, 0)}
        </span>
      </div>
      {groups.map((group, index) => (
        <details
          key={group.sender}
          open={index === 0}
          className="group overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <UserRound className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{group.sender}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {group.items.length} message{group.items.length === 1 ? "" : "s"} ·{" "}
                {String(group.items[0].data.message ?? "").slice(0, 56)}
                {String(group.items[0].data.message ?? "").length > 56 ? "…" : ""}
              </span>
            </span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t bg-muted/20 p-4">
            {group.items
              .slice()
              .reverse()
              .map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl border p-4 ${message.data.is_mine ? "ml-8 border-red-200 bg-red-50 text-red-950" : "mr-8 bg-card"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${message.data.is_mine ? "text-red-700" : "text-primary"}`}
                    >
                      {message.data.is_mine ? "You" : group.sender}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleString()}
                    </span>
                  </div>
                  {message.data.subject && (
                    <p className="mt-2 font-semibold">{message.data.subject}</p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {message.data.message}
                  </p>
                </div>
              ))}
          </div>
        </details>
      ))}
    </section>
  );
}

function RequestCard({
  notification,
  markRead,
}: {
  notification: NotificationRow;
  markRead: (id: string) => void;
}) {
  const details = notification.data ?? {};
  return (
    <article
      className={`rounded-2xl border bg-card p-5 shadow-sm ${notification.read_at ? "opacity-75" : "border-primary/40"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold">{notification.title}</h2>
            <p className="text-sm text-muted-foreground">{notification.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(notification.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        {!notification.read_at && (
          <Button size="sm" variant="outline" onClick={() => markRead(notification.id)}>
            <Check className="mr-1 size-4" />
            Mark read
          </Button>
        )}
      </div>
      <div className="mt-4 grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
        <Detail icon={UserRound} label="Sender" value={details.contact_name} />
        <Detail icon={MessageSquareText} label="Contact type" value={details.organisation_type} />
        <Detail icon={Mail} label="Email" value={details.email} />
        <Detail icon={Phone} label="Phone" value={details.phone || "Not provided"} />
        <div className="sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Message
          </span>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{details.message}</p>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="break-words font-medium">{value || "Not provided"}</span>
      </div>
    </div>
  );
}
