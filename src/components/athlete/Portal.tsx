import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  FileText,
  HeartPulse,
  LockKeyhole,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trophy,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { CareRequests } from "@/components/vito/CareRequests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { EditablePhoto, PhotoAvatar, fileToPhotoPath } from "@/components/vito/Photo";
import { Inbox } from "@/components/vito/Communications";
import { supabase } from "@/integrations/supabase/client";
import { contactClinician, reportInjury } from "@/lib/athlete.functions";
import { loadAthleteProfile, saveAthleteProfile } from "@/lib/profile.functions";
import { updateLinkedPhoto } from "@/lib/photo.functions";
import { SocialProfile } from "@/components/vito/SocialProfile";
import { STAGE_LABEL, stageProgress, useHealth, useViewer } from "./data";
import { AthleteHome } from "./AthleteHome";

type View = "home" | "profile";
type HomeSection =
  "overview" | "register" | "actions" | "connections" | "recovery" | "updates" | "activity";
type Tool =
  | "injuries"
  | "rehab"
  | "assessments"
  | "appointments"
  | "reports"
  | "messages"
  | "report"
  | "contact"
  | "notifications";
const tools: { key: Tool; label: string; icon: typeof HeartPulse }[] = [
  { key: "report", label: "Register new case", icon: Plus },
  { key: "injuries", label: "My injuries", icon: HeartPulse },
  { key: "rehab", label: "Rehabilitation", icon: Dumbbell },
  { key: "assessments", label: "Assessments", icon: ShieldCheck },
  { key: "contact", label: "Contact clinician", icon: MessageSquare },
  { key: "appointments", label: "Appointments", icon: CalendarDays },
  { key: "reports", label: "Reports & history", icon: FileText },
  { key: "notifications", label: "Care updates", icon: Activity },
];
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not scheduled";
const homeSections: { key: HomeSection; label: string }[] = [
  { key: "overview", label: "Care overview" },
  { key: "register", label: "Register new case" },
  { key: "actions", label: "Quick actions" },
  { key: "connections", label: "Connections" },
  { key: "recovery", label: "Recovery tracking" },
  { key: "updates", label: "Care updates" },
  { key: "activity", label: "Sporting activity" },
];

export function AthletePortal({
  user,
  view = "home",
  initialTab,
}: {
  user: User;
  view?: View;
  initialTab?: "overview" | "requests" | undefined;
}) {
  const viewer = useViewer(user);
  const health = useHealth(user.id, view === "profile");
  const profileData = useQuery({
    queryKey: ["athlete-profile", user.id],
    enabled: view === "profile",
    queryFn: () => loadAthleteProfile({ data: {} }),
  });
  const qc = useQueryClient();
  const [tool, setTool] = useState<Tool | null>(null);
  const [homeSection, setHomeSection] = useState<HomeSection>("overview");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const h = health.data;
  const v = viewer.data;
  const athlete = h?.athletes[0];
  const profile = profileData.data;
  const profileAthlete = profile?.athlete ?? athlete;
  if (view === "home") return <AthleteHome user={user} initialTab={initialTab} />;
  return (
    <div
      className={
        view === "profile"
          ? "fixed inset-0 z-50 overflow-y-auto bg-background"
          : "min-h-screen bg-background"
      }
    >
      <main
        className={
          view === "profile"
            ? "min-h-dvh w-full pt-0"
            : "mx-auto max-w-6xl space-y-8 px-4 pb-10 pt-2 sm:px-5"
        }
      >
        {view === "profile" && (
          <div className="min-h-screen">
            <div className="min-h-dvh w-full">
              <SocialProfile
                profileId={user.id}
                viewerId={user.id}
                isOwner
                onEditProfile={() => setEditing(true)}
              />
            </div>
          </div>
        )}
      </main>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <EditablePhoto
              path={v?.avatar ?? null}
              name={v?.name ?? null}
              target="profile"
              targetId={user.id}
              onUpdated={() => {
                qc.invalidateQueries({ queryKey: ["viewer", user.id] });
                qc.invalidateQueries({ queryKey: ["app-header", user.id] });
                qc.invalidateQueries({ queryKey: ["social-profile", user.id] });
                qc.invalidateQueries({ queryKey: ["athlete-profile", user.id] });
              }}
            />
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const split = (key: string) =>
                  String(f.get(key) ?? "")
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
                setBusy(true);
                try {
                  await saveAthleteProfile({
                    data: {
                      full_name: String(f.get("full_name") ?? "").trim(),
                      first_name: String(f.get("first_name") ?? "").trim(),
                      surname: String(f.get("surname") ?? "").trim(),
                      sport: String(f.get("sport") ?? "").trim() || null,
                      date_of_birth: String(f.get("date_of_birth") ?? "") || null,
                      phone: String(f.get("phone") ?? "").trim() || null,
                      headline: String(f.get("headline") ?? "").trim() || null,
                      position: String(f.get("position") ?? "").trim() || null,
                      school_name: String(f.get("school_name") ?? "").trim() || null,
                      team: String(f.get("team") ?? "").trim() || null,
                      district: String(f.get("district") ?? "").trim() || null,
                      country: String(f.get("country") ?? "").trim() || null,
                      bio: String(f.get("bio") ?? "").trim() || null,
                      skills: split("skills"),
                      interests: split("interests"),
                      discoverable: profile?.community?.discoverable ?? true,
                      visibility: String(f.get("visibility") ?? "community") as
                        "community" | "connections",
                    },
                  });
                  toast.success("Profile updated");
                  qc.invalidateQueries({ queryKey: ["viewer", user.id] });
                  qc.invalidateQueries({ queryKey: ["app-header", user.id] });
                  qc.invalidateQueries({ queryKey: ["social-profile", user.id] });
                  qc.invalidateQueries({ queryKey: ["athlete-profile", user.id] });
                  qc.invalidateQueries({ queryKey: ["athlete-health", user.id] });
                  setEditing(false);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Profile could not be saved.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="sm:col-span-2">
                <Label htmlFor="profile-full-name">Display name</Label>
                <Input
                  id="profile-full-name"
                  name="full_name"
                  required
                  maxLength={120}
                  defaultValue={profile?.profile?.full_name ?? v?.name ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-first-name">First name</Label>
                <Input
                  id="profile-first-name"
                  name="first_name"
                  required
                  maxLength={120}
                  defaultValue={profileAthlete?.first_name ?? v?.firstName ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-surname">Surname</Label>
                <Input
                  id="profile-surname"
                  name="surname"
                  required
                  maxLength={120}
                  defaultValue={profileAthlete?.surname ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-sport">Sport</Label>
                <Input
                  id="profile-sport"
                  name="sport"
                  maxLength={80}
                  defaultValue={profileAthlete?.sport ?? profile?.community?.sport ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-position">Position / event</Label>
                <Input
                  id="profile-position"
                  name="position"
                  maxLength={80}
                  defaultValue={profile?.community?.position ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-school">School / academy / club</Label>
                <Input
                  id="profile-school"
                  name="school_name"
                  maxLength={160}
                  defaultValue={profile?.community?.school_name ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-team">Team</Label>
                <Input
                  id="profile-team"
                  name="team"
                  maxLength={120}
                  defaultValue={profile?.community?.team ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-dob">Date of birth</Label>
                <Input
                  id="profile-dob"
                  name="date_of_birth"
                  type="date"
                  defaultValue={profileAthlete?.date_of_birth ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  name="phone"
                  maxLength={40}
                  defaultValue={profileAthlete?.phone ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="profile-district">District of residence</Label>
                <Input
                  id="profile-district"
                  name="district"
                  maxLength={120}
                  defaultValue={profile?.community?.district ?? ""}
                  className="mt-1"
                  placeholder="District or region"
                />
              </div>
              <div>
                <Label htmlFor="profile-country">Country of residence</Label>
                <Input
                  id="profile-country"
                  name="country"
                  maxLength={120}
                  defaultValue={profile?.community?.country ?? ""}
                  className="mt-1"
                  placeholder="Country"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="profile-headline">Profile headline</Label>
                <Input
                  id="profile-headline"
                  name="headline"
                  maxLength={120}
                  defaultValue={profile?.community?.headline ?? ""}
                  className="mt-1"
                  placeholder="A short introduction"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="profile-bio">About the athlete</Label>
                <Textarea
                  id="profile-bio"
                  name="bio"
                  maxLength={1500}
                  defaultValue={profile?.community?.bio ?? ""}
                  className="mt-1"
                  rows={5}
                  placeholder="Share the athlete’s sporting journey, goals, and interests…"
                  aria-describedby="profile-bio-guidance"
                />
                <p
                  id="profile-bio-guidance"
                  className="mt-1 text-xs leading-5 text-muted-foreground"
                >
                  Focus on sport, goals, and achievements. Keep private medical or case details out
                  of the public profile.
                </p>
              </div>
              <div>
                <Label htmlFor="profile-skills">Skills</Label>
                <Input
                  id="profile-skills"
                  name="skills"
                  defaultValue={(profile?.community?.skills ?? []).join(", ")}
                  className="mt-1"
                  placeholder="Comma-separated"
                />
              </div>
              <div>
                <Label htmlFor="profile-interests">Interests</Label>
                <Input
                  id="profile-interests"
                  name="interests"
                  defaultValue={(profile?.community?.interests ?? []).join(", ")}
                  className="mt-1"
                  placeholder="Comma-separated"
                />
              </div>
              <div>
                <Label htmlFor="profile-visibility">Profile visibility</Label>
                <select
                  id="profile-visibility"
                  name="visibility"
                  defaultValue={profile?.community?.visibility ?? "community"}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="community">Visible to the VITO community</option>
                  <option value="connections">Visible to connections only</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Heading({ title, icon: Icon }: { title: string; icon: typeof HeartPulse }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
      <Icon className="size-5 text-primary" />
      {title}
    </h2>
  );
}
function Empty({ icon: Icon, text }: { icon: typeof HeartPulse; text: string }) {
  return (
    <div className="flex min-h-28 items-center gap-3 py-6 text-sm text-muted-foreground">
      <Icon className="size-7 shrink-0 text-muted-foreground/60" />
      <p>{text}</p>
    </div>
  );
}
function Summary({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof HeartPulse;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-full min-h-36 flex-col items-stretch justify-start gap-3 whitespace-normal bg-card p-4 text-left"
    >
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        <Icon className="size-4 text-accent" />
      </span>
      <span className="text-xl font-bold text-foreground">{value}</span>
      <span className="text-xs font-normal text-muted-foreground">{detail}</span>
    </Button>
  );
}
function CoverPhotoEditor({
  path,
  userId,
  onUpdated,
}: {
  path?: string | null;
  userId: string;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/30 bg-black/35 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/55">
        <Upload className="size-4" />
        {busy ? "Uploading…" : path ? "Change cover photo" : "Upload cover photo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setMessage("");
            try {
              const nextPath = await fileToPhotoPath(file);
              await updateLinkedPhoto({
                data: { target: "community-cover", targetId: userId, path: nextPath },
              });
              setMessage("Cover updated");
              onUpdated();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Upload failed");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {message && (
        <p className="mt-1 rounded bg-black/45 px-2 py-1 text-right text-[11px] text-white">
          {message}
        </p>
      )}
    </div>
  );
}
