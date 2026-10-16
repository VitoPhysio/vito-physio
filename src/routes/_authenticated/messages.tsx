import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Filter,
  LoaderCircle,
  MessageCircle,
  MessageCirclePlus,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smile,
  UserPlus,
  UserRound,
  Video,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PhotoAvatar } from "@/components/vito/Photo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  avatar_path: string | null;
  role?: string | null;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
type Participant = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
};
type Conversation = {
  id: string;
  kind: "direct" | "group";
  created_at: string;
  last_message_at: string;
};
type ConversationView = Conversation & {
  participants: Participant[];
  messages: Message[];
  otherProfiles: Profile[];
  latest: Message | null;
  unread: number;
  displayName: string;
  avatarPath: string | null;
  otherUserId: string | null;
  otherRole: string | null;
};

type Filter = "all" | "unread" | "read";
type MessagingUser = {
  id: string;
  full_name: string | null;
  avatar_path: string | null;
  role: string;
};

function MessagesPage() {
  const { user } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [startingConversation, setStartingConversation] = useState(false);

  const conversations = useQuery({
    queryKey: ["messages", user.id],
    queryFn: () => loadConversations(user.id),
    staleTime: 5_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages-inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: ["messages", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user.id]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (conversations.data ?? []).filter((conversation) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" ? conversation.unread > 0 : conversation.unread === 0);
      const matchesQuery =
        !needle ||
        `${conversation.displayName} ${conversation.latest?.body ?? ""}`
          .toLowerCase()
          .includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [conversations.data, filter, query]);

  const selected =
    (conversations.data ?? []).find((conversation) => conversation.id === selectedId) ?? null;
  const messagingUsers = useQuery({
    queryKey: ["messaging-users", user.id],
    queryFn: () => loadMessagingUsers(),
    enabled: newConversationOpen,
    staleTime: 60_000,
    retry: 1,
  });
  const filteredUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    return (messagingUsers.data ?? [])
      .filter((member) => {
        if (!needle) return true;
        return `${member.full_name ?? ""} ${member.role}`.toLowerCase().includes(needle);
      })
      .sort((first, second) =>
        messagingUserDisplayName(first).localeCompare(messagingUserDisplayName(second), undefined, {
          sensitivity: "base",
        }),
      );
  }, [messagingUsers.data, userSearch]);

  async function startConversation(member: MessagingUser) {
    setStartingConversation(true);
    const { data: conversationId, error } = await supabase.rpc("create_direct_conversation", {
      _other_user: member.id,
    });
    setStartingConversation(false);
    if (error || !conversationId) {
      toast.error(error?.message ?? "Unable to start this conversation.");
      return;
    }
    setNewConversationOpen(false);
    setUserSearch("");
    await queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
    setSelectedId(conversationId);
  }

  async function openConversation(conversation: ConversationView) {
    setSelectedId(conversation.id);
    const { error } = await supabase.rpc("mark_conversation_read", {
      _conversation_id: conversation.id,
    });
    if (!error) void queryClient.invalidateQueries({ queryKey: ["messages", user.id] });
  }

  function closeMessages() {
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({ to: "/" });
  }

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {!selected && (
        <header className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-3 shadow-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={closeMessages}
              aria-label="Go back to previous page"
              className="grid size-10 shrink-0 place-items-center rounded-full text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="size-5" />
            </button>
            <PhotoAvatar
              path={null}
              name="Messages"
              className="size-10 bg-primary text-primary-foreground"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Messages</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Conversations with your VITO Physio team
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="size-4" />
                  <span className="hidden sm:inline">{filterLabel(filter)}</span>
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["all", "unread", "read"] as Filter[]).map((value) => (
                  <DropdownMenuItem key={value} onSelect={() => setFilter(value)}>
                    {filterLabel(value)}
                    {filter === value && <Check className="ml-auto size-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r bg-muted/20`}
        >
          <div className="shrink-0 border-b p-4">
            <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm text-muted-foreground shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="size-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Loading conversations…
              </div>
            ) : conversations.error ? (
              <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-destructive">
                <p>{conversationErrorMessage(conversations.error)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void conversations.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : filtered.length ? (
              filtered.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === selectedId}
                  onSelect={() => void openConversation(conversation)}
                />
              ))
            ) : (
              <EmptyInbox hasSearch={Boolean(query || filter !== "all")} />
            )}
          </div>
        </aside>

        <main
          className={`${selected ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col bg-secondary/25`}
        >
          {selected ? (
            <ChatView
              conversation={selected}
              userId={user.id}
              onBack={() => setSelectedId(null)}
              onOpenProfile={(participantId) => window.location.assign(`/members/${participantId}`)}
              onSent={() => void queryClient.invalidateQueries({ queryKey: ["messages", user.id] })}
            />
          ) : (
            <div className="m-auto max-w-sm px-8 text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-4 size-14 text-primary/70" />
              <h2 className="text-lg font-bold text-foreground">Select a conversation</h2>
              <p className="mt-2 text-sm">
                Choose a conversation to view messages and send a reply.
              </p>
            </div>
          )}
        </main>
      </div>

      {!selected && (
        <Button
          type="button"
          onClick={() => setNewConversationOpen(true)}
          aria-label="Start a new conversation"
          title="Start a new conversation"
          className="fixed bottom-6 right-5 z-20 size-16 rounded-full bg-primary p-0 text-primary-foreground shadow-[0_10px_28px_rgba(80,35,168,0.32)] transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:bottom-8 sm:right-8 sm:size-[4.5rem]"
        >
          <MessageCirclePlus className="size-8" strokeWidth={2.25} />
        </Button>
      )}

      {newConversationOpen && (
        <section
          aria-label="Start a new conversation"
          className="fixed inset-0 z-[130] flex h-[100dvh] min-h-0 flex-col bg-background text-foreground"
        >
          <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3 shadow-sm sm:px-6">
            <button
              type="button"
              onClick={() => {
                setNewConversationOpen(false);
                setUserSearch("");
              }}
              aria-label="Close registered users"
              className="grid size-10 shrink-0 place-items-center rounded-full text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="size-5" />
            </button>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">
              <UserPlus className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black tracking-tight sm:text-2xl">
                New conversation
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                Choose a registered VITO Physio user
              </p>
            </div>
          </header>

          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            <div className="shrink-0 border-b bg-background p-4 sm:p-5">
              <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-sm text-muted-foreground shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <Search className="size-5 shrink-0 text-primary" />
                <input
                  autoFocus
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search Vito users by name"
                  aria-label="Search Vito registered users by name"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
              <div className="flex items-center justify-between border-b bg-background px-4 py-3 sm:px-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {userSearch.trim() ? "Search results" : "All VITO Physio users"}
                </p>
                {!messagingUsers.isLoading && !messagingUsers.error && (
                  <span className="text-xs text-muted-foreground">
                    {filteredUsers.length} users
                  </span>
                )}
              </div>

              {messagingUsers.isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
                  <LoaderCircle className="size-6 animate-spin text-primary" />
                  Loading registered users…
                </div>
              ) : messagingUsers.error ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-destructive">
                  <p>{userPickerErrorMessage(messagingUsers.error)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void messagingUsers.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : filteredUsers.length ? (
                <div className="divide-y">
                  {filteredUsers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={startingConversation}
                      onClick={() => void startConversation(member)}
                      className="flex w-full items-center gap-3 bg-card px-4 py-4 text-left transition hover:bg-secondary disabled:cursor-wait disabled:opacity-60 sm:px-5"
                    >
                      <PhotoAvatar
                        path={member.avatar_path}
                        name={member.full_name}
                        className="size-12 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-foreground">
                          {messagingUserDisplayName(member)}
                        </span>
                        <span className="mt-1 block truncate text-xs capitalize text-muted-foreground">
                          {member.role.replaceAll("_", " ")}
                        </span>
                      </span>
                      <MessageCircle className="size-5 shrink-0 text-primary" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
                  <UserPlus className="size-8 text-primary/60" />
                  <p>
                    {userSearch.trim()
                      ? `No VITO users match “${userSearch}”.`
                      : "No registered VITO users found."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: ConversationView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 border-b px-4 py-4 text-left transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selected ? "bg-secondary" : "bg-card"}`}
    >
      <PhotoAvatar
        path={conversation.avatarPath}
        name={conversation.displayName}
        className="size-12 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-bold">{conversation.displayName}</span>
          <span
            className={`shrink-0 text-xs ${conversation.unread ? "font-bold text-primary" : "text-muted-foreground"}`}
          >
            {formatChatTime(conversation.last_message_at)}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-sm ${conversation.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {conversation.latest?.body ?? "No messages yet"}
          </span>
          {conversation.unread > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {conversation.unread > 99 ? "99+" : conversation.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function ChatView({
  conversation,
  userId,
  onBack,
  onOpenProfile,
  onSent,
}: {
  conversation: ConversationView;
  userId: string;
  onBack: () => void;
  onOpenProfile: (participantId: string) => void;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight });
  }, [conversation.messages.length, conversation.id]);

  async function sendMessage() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: userId,
      body: text,
    });
    setSending(false);
    if (error) {
      toast.error("Your message could not be sent. Please try again.");
      return;
    }
    setBody("");
    onSent();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3 shadow-sm sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="grid size-9 place-items-center rounded-full text-primary hover:bg-secondary md:hidden"
          aria-label="Back to messages"
        >
          <ArrowLeft className="size-5" />
        </button>
        {conversation.otherUserId ? (
          <button
            type="button"
            onClick={() => onOpenProfile(conversation.otherUserId!)}
            aria-label={`Open ${conversation.displayName}'s profile`}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <PhotoAvatar
              path={conversation.avatarPath}
              name={conversation.displayName}
              className="size-11"
            />
          </button>
        ) : (
          <PhotoAvatar
            path={conversation.avatarPath}
            name={conversation.displayName}
            className="size-11 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          {conversation.otherUserId ? (
            <button
              type="button"
              onClick={() => onOpenProfile(conversation.otherUserId!)}
              className="block max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <h2 className="truncate font-bold">{conversation.displayName}</h2>
            </button>
          ) : (
            <h2 className="truncate font-bold">{conversation.displayName}</h2>
          )}
          <p className="text-xs text-muted-foreground">{roleLabel(conversation.otherRole)}</p>
        </div>
        <button
          type="button"
          disabled
          title="Voice calls are coming soon"
          aria-label="Voice calls are not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Phone className="size-5" />
        </button>
        <button
          type="button"
          disabled
          title="Video calls are coming soon"
          aria-label="Video calls are not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Video className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Conversation options"
          className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
        >
          <MoreVertical className="size-5" />
        </button>
      </header>

      <div
        ref={historyRef}
        className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5 sm:px-8"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {conversation.messages.length ? (
            conversation.messages.map((message, index) => {
              const mine = message.sender_id === userId;
              const previous = conversation.messages[index - 1];
              const showDate = !previous || !sameDay(previous.created_at, message.created_at);
              return (
                <div key={message.id}>
                  {showDate && (
                    <p className="mx-auto mb-3 w-fit rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      {formatDate(message.created_at)}
                    </p>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[70%] ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                      >
                        {formatMessageTime(message.created_at)}
                        {mine && <CheckCheck className="size-3" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="m-auto py-20 text-center text-sm text-muted-foreground">
              Start the conversation with a message.
            </div>
          )}
        </div>
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <button
          type="button"
          disabled
          title="Attachments are coming soon"
          aria-label="Attachments are not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Paperclip className="size-5" />
        </button>
        <button
          type="button"
          disabled
          title="Emoji picker is coming soon"
          aria-label="Emoji picker is not available"
          className="hidden rounded-full p-2 text-muted-foreground opacity-50 sm:inline-flex"
        >
          <Smile className="size-5" />
        </button>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          placeholder="Write a message…"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label="Send message"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

async function loadMessagingUsers(): Promise<MessagingUser[]> {
  const { data, error } = await supabase.rpc("list_messaging_users", { _query: null });
  if (error) throw error;
  return data ?? [];
}

async function loadConversations(userId: string): Promise<ConversationView[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_participants")
    .select("conversation_id,user_id,last_read_at")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;
  const ids = (memberships ?? []).map((row: Participant) => row.conversation_id);
  if (!ids.length) return [];

  const [
    { data: conversations, error: conversationError },
    { data: allParticipants, error: participantError },
    { data: messages, error: messageError },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id,kind,created_at,last_message_at")
      .in("id", ids)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("conversation_participants")
      .select("conversation_id,user_id,last_read_at")
      .in("conversation_id", ids),
    supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true }),
  ]);
  if (conversationError || participantError || messageError)
    throw conversationError ?? participantError ?? messageError;

  const participantIds = [
    ...new Set((allParticipants ?? []).map((row: Participant) => row.user_id)),
  ];
  const [{ data: directoryUsers, error: directoryError }, conversationProfiles] = await Promise.all([
    supabase.rpc("list_messaging_users", { _query: null }),
    Promise.all(
      participantIds.map(async (participantId) => {
        const { data, error } = await supabase.rpc("get_messaging_member_profile", {
          _user_id: participantId,
        });
        if (error) throw error;
        return data?.[0] ?? null;
      }),
    ),
  ]);
  if (directoryError) throw directoryError;
  const roleMap = new Map(
    (directoryUsers ?? []).map((member) => [member.id, member.role] as const),
  );
  const profileMap = new Map<string, Profile>(
    conversationProfiles
      .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
      .map((profile) => [
        profile.id,
        {
          id: profile.id,
          full_name: profile.full_name,
          avatar_path: profile.avatar_path,
          role: profile.role ?? roleMap.get(profile.id) ?? null,
        },
      ]),
  );
  const messageMap = new Map<string, Message[]>();
  for (const message of (messages ?? []) as Message[]) {
    const existing = messageMap.get(message.conversation_id) ?? [];
    existing.push(message);
    messageMap.set(message.conversation_id, existing);
  }

  return ((conversations ?? []) as Conversation[]).map((conversation) => {
    const participants = ((allParticipants ?? []) as Participant[]).filter(
      (row) => row.conversation_id === conversation.id,
    );
    const otherProfiles = participants
      .filter((row) => row.user_id !== userId)
      .map((row) => profileMap.get(row.user_id))
      .filter(Boolean) as Profile[];
    const conversationMessages = messageMap.get(conversation.id) ?? [];
    const latest = conversationMessages.at(-1) ?? null;
    const ownMembership = participants.find((row) => row.user_id === userId);
    const unread = conversationMessages.filter(
      (message) =>
        message.sender_id !== userId &&
        (!ownMembership?.last_read_at || message.created_at > ownMembership.last_read_at),
    ).length;
    return {
      ...conversation,
      participants,
      messages: conversationMessages,
      otherProfiles,
      latest,
      unread,
      displayName:
        otherProfiles.map((profile) => profile.full_name || "VITO Physio member").join(", ") ||
        "VITO Physio member",
      avatarPath: otherProfiles[0]?.avatar_path ?? null,
      otherUserId: otherProfiles.length === 1 ? otherProfiles[0].id : null,
      otherRole: otherProfiles.length === 1 ? (otherProfiles[0].role ?? null) : null,
    };
  });
}

function conversationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/relation .* does not exist|schema cache|could not find|PGRST205/i.test(message)) {
    return "Messaging storage is not connected yet. Apply the messaging migration, then try again.";
  }
  return "Unable to load your conversations. Please try again.";
}

function userPickerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/function .*list_messaging_users|schema cache|PGRST202/i.test(message)) {
    return "The member directory is not connected yet. Apply the latest messaging migration, then try again.";
  }
  return "Unable to load registered users. Please try again.";
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  vito_admin: "VITO admin",
  clinical_professional: "Clinical professional",
  clinical_supervisor: "Clinical supervisor",
  school_admin: "School admin",
  coach: "Coach",
  athlete: "Athlete",
  parent: "Parent / guardian",
};

function roleLabel(role: string | null | undefined) {
  if (!role) return "VITO Physio member";
  return ROLE_LABEL[role] ?? role.replaceAll("_", " ");
}

function messagingUserDisplayName(member: MessagingUser) {
  return member.full_name?.trim() || "VITO Physio member";
}

function filterLabel(filter: Filter) {
  return filter[0].toUpperCase() + filter.slice(1);
}

function formatChatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function sameDay(left: string, right: string) {
  return new Date(left).toDateString() === new Date(right).toDateString();
}

function EmptyInbox({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center px-8 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
        <UserRound className="size-7" />
      </span>
      <h2 className="mt-4 font-bold">
        {hasSearch ? "No matching conversations" : "No conversations yet"}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {hasSearch
          ? "Try a different search or filter."
          : "Your messages with athletes, clinicians, coaches, and other VITO Physio members will appear here."}
      </p>
    </div>
  );
}
