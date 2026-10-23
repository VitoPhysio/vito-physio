import { useState } from "react";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { AthletePortal } from "@/components/athlete/Portal";
import { SocialProfile } from "./SocialProfile";
import { EditablePhoto } from "./Photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadMemberProfile, saveMemberProfile } from "@/lib/member-profile.functions";
import { memberProfileInput } from "@/lib/member-profile";

export const memberProfileQuery = (id: string) => queryOptions({ queryKey: ["member-profile", id], queryFn: () => loadMemberProfile() });

export function MemberProfile({ user }: { user: User }) {
  const { data } = useSuspenseQuery(memberProfileQuery(user.id));
  const qc = useQueryClient();
  const save = useServerFn(saveMemberProfile);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (data.kind === "athlete") return <AthletePortal user={user} view="profile" />;
  const community = data.community;
  const clinical = data.kind === "clinical";
  const coaching = data.kind === "coach";
  const parent = data.kind === "parent";
  const fields: Array<readonly [string, string, number, string | null | undefined]> = [
    ["full_name", "Full name", 120, data.profile.full_name],
    ["headline", "Headline", 120, community?.headline],
    ["position", clinical ? "Professional title" : coaching ? "Coaching role" : parent ? "Relationship / role" : "Job title / role", 80, community?.position],
    ["school_name", clinical ? "Practice / organisation" : parent ? "School / club affiliation" : "School / academy / club / organisation", 160, community?.school_name],
    ...((coaching || parent) ? [["sport", parent ? "Sports interests" : "Sport coached", 80, community?.sport] as const, ["team", "Team", 120, community?.team] as const] : []),
    ["district", "District", 120, community?.district],
    ["country", "Country", 120, community?.country],
    ["skills", clinical ? "Specialties / skills" : coaching ? "Coaching expertise" : "Skills", 1219, community?.skills.join(", ")],
    ["interests", "Interests", 1219, community?.interests.join(", ")],
  ];
  async function refresh() {
    await Promise.all(["member-profile", "social-profile", "viewer", "app-header", "social-posts", "discover"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
  }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
    <SocialProfile profileId={user.id} viewerId={user.id} onEditProfile={() => setEditing(true)} />
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {clinical ? "professional" : coaching ? "coach" : parent ? "parent" : data.kind === "organisation" ? "organisation contact" : "staff"} profile</DialogTitle></DialogHeader>
        <EditablePhoto path={data.profile.avatar_path} name={data.profile.full_name} target="profile" targetId={user.id} onUpdated={() => void refresh()} />
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const text = (key: string) => String(form.get(key) ?? "");
          const tags = (key: string) => text(key).split(",").map((tag) => tag.trim()).filter(Boolean);
          try {
            const input = memberProfileInput.parse({ full_name: text("full_name"), headline: text("headline"), position: text("position"), school_name: text("school_name"), sport: (coaching || parent) ? text("sport") : community?.sport ?? "", team: (coaching || parent) ? text("team") : community?.team ?? "", district: text("district"), country: text("country"), bio: text("bio"), skills: tags("skills"), interests: tags("interests"), discoverable: form.has("discoverable"), visibility: text("visibility") });
            setBusy(true);
            await save({ data: input });
            await refresh(); setEditing(false); toast.success("Profile saved.");
          } catch (error) { toast.error(error instanceof Error ? error.message : "Profile could not be saved."); }
          finally { setBusy(false); }
        }}>
          <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label, max, value]) => <div key={key} className="space-y-1"><Label htmlFor={`member-${key}`}>{label}</Label><Input id={`member-${key}`} name={key} maxLength={max} defaultValue={value ?? ""} required={key === "full_name"} /></div>)}</div>
          <div className="space-y-1"><Label htmlFor="member-bio">About</Label><Textarea id="member-bio" name="bio" maxLength={1500} defaultValue={community?.bio ?? ""} /></div>
          <Label className="flex items-center gap-2"><input type="checkbox" name="discoverable" defaultChecked={community?.discoverable ?? true} />Show in Discover</Label>
          <div className="space-y-1"><Label htmlFor="member-visibility">Profile visibility</Label><select id="member-visibility" name="visibility" className="h-10 w-full rounded-md border bg-background px-3" defaultValue={community?.visibility ?? "community"}><option value="community">Community</option><option value="connections">Connections</option></select></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
