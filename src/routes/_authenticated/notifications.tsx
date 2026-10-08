import { createFileRoute } from "@tanstack/react-router";
import { Bell, Check, Mail, MessageSquareText, Phone, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  data: {
    contact_name?: string;
    email?: string;
    phone?: string;
    organisation_type?: string;
    message?: string;
    sender?: string;
    subject?: string | null;
    audience?: string | null;
    recipient?: string;
  };
  read_at: string | null;
  created_at: string;
};

function NotificationsPage() {
  const { data: user } = useQuery({
    queryKey: ["notifications-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const client = supabase as any;
      const [{ data, error }, { data: messages }] = await Promise.all([
        client
          .from("notifications")
          .select("id,title,body,kind,data,read_at,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        client
          .from("communications")
          .select("id,sender_id,subject,body,audience,recipient_id,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (error) throw error;
      const senderIds = [
        ...new Set((messages ?? []).map((message: { sender_id: string }) => message.sender_id)),
      ];
      const { data: senders } = senderIds.length
        ? await client.rpc("get_sender_names", { _ids: senderIds })
        : { data: [] };
      const senderMap = new Map(
        (senders ?? []).map((sender: { id: string; full_name?: string; is_admin?: boolean }) => [
          sender.id,
          sender.is_admin ? "VITO administration (admin)" : (sender.full_name ?? "VITO clinician"),
        ]),
      );
      const communicationNotifications = (messages ?? []).map(
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
            subject: message.subject,
            message: message.body,
            audience: message.audience,
            recipient: message.recipient_id,
          },
          read_at: null,
          created_at: message.created_at,
        }),
      );
      return [...((data ?? []) as NotificationRow[]), ...communicationNotifications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
    },
  });

  async function markRead(id: string) {
    const client = supabase as any;
    await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    await refetch();
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Staff inbox</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Notifications</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Consultation requests and other alerts assigned to your account.
            </p>
          </div>
          <Bell className="size-8 text-primary" aria-hidden="true" />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            You are all caught up.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const details = notification.data ?? {};
              return (
                <article
                  key={notification.id}
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
                    {!notification.read_at && notification.kind !== "communication" && (
                      <Button size="sm" variant="outline" onClick={() => markRead(notification.id)}>
                        <Check className="mr-1 size-4" />
                        Mark read
                      </Button>
                    )}
                  </div>
                  {notification.kind === "consultation" && (
                    <div className="mt-4 grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
                      <Detail icon={UserRound} label="Sender" value={details.contact_name} />
                      <Detail
                        icon={MessageSquareText}
                        label="Contact type"
                        value={details.organisation_type}
                      />
                      <Detail icon={Mail} label="Email" value={details.email} />
                      <Detail icon={Phone} label="Phone" value={details.phone || "Not provided"} />
                      <div className="sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Message
                        </span>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                          {details.message}
                        </p>
                      </div>
                    </div>
                  )}
                  {notification.kind === "communication" && (
                    <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
                      <p className="font-semibold text-foreground">
                        From: {details.sender || "VITO team"}
                      </p>
                      {details.audience && (
                        <p className="mt-1 text-xs text-accent">Audience: {details.audience}</p>
                      )}
                      <p className="mt-3 whitespace-pre-wrap leading-relaxed">{details.message}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value?: string;
}) {
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
