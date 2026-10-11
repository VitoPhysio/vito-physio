import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Globe2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoAvatar } from "@/components/vito/Photo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/members/$memberId")({
  component: MemberProfilePage,
});

type MemberCard = {
  id: string;
  full_name: string;
  avatar_path: string | null;
  cover_path: string | null;
  role: string;
  headline: string | null;
  sport: string | null;
  position: string | null;
  school: string | null;
  school_id: string | null;
  school_verified: boolean;
  team: string | null;
  visibility: string;
};

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

function MemberProfilePage() {
  const { memberId } = Route.useParams();
  const profile = useQuery({
    queryKey: ["member-profile", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_messaging_member_profile", {
        _user_id: memberId,
      });
      if (error) throw error;
      return (data?.[0] as MemberCard | undefined) ?? null;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <Link
          to="/messages"
          aria-label="Back to messages"
          className="grid size-10 place-items-center rounded-full text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">VITO Physio</p>
          <h1 className="truncate text-xl font-black tracking-tight">Member profile</h1>
        </div>
      </header>

      {profile.isLoading ? (
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-muted-foreground">
          Loading profile…
        </div>
      ) : profile.error ? (
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <ShieldCheck className="size-12 text-destructive" />
          <div>
            <h2 className="text-lg font-bold">Profile unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This member profile is not available to your account or could not be loaded.
            </p>
          </div>
          <Button variant="outline" onClick={() => void profile.refetch()}>
            Try again
          </Button>
        </div>
      ) : profile.data ? (
        <ProfileDashboard member={profile.data} />
      ) : (
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <Users className="size-12 text-primary/70" />
          <div>
            <h2 className="text-lg font-bold">Member not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This VITO Physio profile may no longer be discoverable.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/messages">Return to messages</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function ProfileDashboard({ member }: { member: MemberCard }) {
  const name = member.full_name?.trim() || "VITO Physio member";
  const isAthlete = member.role === "athlete";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
      <section className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent sm:h-56">
          {member.cover_path ? (
            <img src={member.cover_path} alt="" className="h-full w-full object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.18),transparent_32%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
        </div>
        <div className="relative -mt-16 flex flex-col gap-4 px-5 pb-6 sm:-mt-20 sm:px-8">
          <PhotoAvatar
            path={member.avatar_path}
            name={name}
            className="size-28 border-4 border-card bg-secondary text-3xl shadow-xl sm:size-36"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              {isAthlete ? "Athlete profile dashboard" : "VITO Physio profile"}
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">{name}</h2>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {roleLabel(member.role)}
            </p>
            {member.headline && (
              <p className="mt-2 max-w-2xl text-sm leading-6">{member.headline}</p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            <h3 className="text-lg font-bold">
              {isAthlete ? "Athlete identity" : "Professional identity"}
            </h3>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info label="Account type" value={roleLabel(member.role)} />
            <Info label="Sport" value={member.sport || "Not added"} />
            <Info label="Position" value={member.position || "Not added"} />
            <Info label="Team" value={member.team || "Not added"} />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            <h3 className="text-lg font-bold">Community</h3>
          </div>
          <div className="mt-5 space-y-4">
            <Info label="School or organisation" value={member.school || "Not added"} />
            {member.school_verified && (
              <p className="flex items-center gap-2 text-sm text-primary">
                <BadgeCheck className="size-4" /> Verified affiliation
              </p>
            )}
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe2 className="size-4" /> VITO Physio community
            </p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border bg-secondary/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">Continue the conversation</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Return to Messages to view your conversation with {name}.
            </p>
          </div>
          <Button asChild>
            <Link to="/messages">
              <MessageCircle className="size-4" /> Messages
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
