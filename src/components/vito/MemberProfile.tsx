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
import { memberProfileCopy, memberProfileInput } from "@/lib/member-profile";

export const memberProfileQuery = (id: string) =>
  queryOptions({ queryKey: ["member-profile", id], queryFn: () => loadMemberProfile() });

type EditableField = readonly [string, string, number, string | null | undefined];

export function MemberProfile({ user }: { user: User }) {
  const { data } = useSuspenseQuery(memberProfileQuery(user.id));
  const qc = useQueryClient();
  const save = useServerFn(saveMemberProfile);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (data.kind === "athlete") return <AthletePortal user={user} view="profile" />;

  const community = data.community;
  const copy = memberProfileCopy(data.kind);
  const coaching = data.kind === "coach";
  const parent = data.kind === "parent";
  const isStaff = data.kind === "staff";
  const accountName =
    data.profile.full_name?.trim() || (isStaff ? "VITO Physio admin" : "Institution administrator");
  const fields: EditableField[] = [
    ...(copy.showAccountName
      ? [["full_name", "Full name", 120, data.profile.full_name] as const]
      : []),
    ["headline", copy.headlineLabel, 120, community?.headline],
    ["position", copy.positionLabel, 80, community?.position],
    ...(copy.showInstitutionField
      ? [["school_name", copy.institutionLabel, 160, community?.school_name] as const]
      : []),
    ...(copy.showSportAndTeam
      ? [
          [
            "sport",
            parent ? "Sports interests" : coaching ? "Sport coached" : "Sport",
            80,
            community?.sport,
          ] as const,
          ["team", coaching ? "Team(s) coached" : "Team / club", 120, community?.team] as const,
        ]
      : []),
    ["district", copy.districtLabel, 120, community?.district],
    ["country", copy.countryLabel, 120, community?.country],
    ["skills", copy.skillsLabel, 1219, community?.skills.join(", ")],
    ["interests", copy.interestsLabel, 1219, community?.interests.join(", ")],
  ];

  async function refresh() {
    await Promise.all(
      ["member-profile", "social-profile", "viewer", "app-header", "social-posts", "discover"].map(
        (key) => qc.invalidateQueries({ queryKey: [key] }),
      ),
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <SocialProfile
        profileId={user.id}
        viewerId={user.id}
        onEditProfile={() => setEditing(true)}
      />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {copy.editorTitle}</DialogTitle>
          </DialogHeader>
          <EditablePhoto
            path={data.profile.avatar_path}
            name={data.profile.full_name}
            target="profile"
            targetId={user.id}
            onUpdated={() => void refresh()}
          />
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const text = (key: string) => String(form.get(key) ?? "");
              const tags = (key: string) =>
                text(key)
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean);
              try {
                const input = memberProfileInput.parse({
                  full_name: copy.showAccountName ? text("full_name") : accountName,
                  headline: text("headline"),
                  position: text("position"),
                  school_name: isStaff ? "VITO Physio" : text("school_name"),
                  sport: copy.showSportAndTeam ? text("sport") : (community?.sport ?? ""),
                  team: copy.showSportAndTeam ? text("team") : (community?.team ?? ""),
                  district: text("district"),
                  country: text("country"),
                  bio: text("bio"),
                  skills: tags("skills"),
                  interests: tags("interests"),
                  discoverable: form.has("discoverable"),
                  visibility: text("visibility"),
                });
                setBusy(true);
                await save({ data: input });
                await refresh();
                setEditing(false);
                toast.success("Profile saved.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Profile could not be saved.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {!copy.showAccountName && (
              <input type="hidden" name="full_name" value={accountName} readOnly />
            )}
            {isStaff && <input type="hidden" name="school_name" value="VITO Physio" readOnly />}
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(([key, label, max, value]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`member-${key}`}>{label}</Label>
                  <Input
                    id={`member-${key}`}
                    name={key}
                    maxLength={max}
                    defaultValue={value ?? ""}
                    required={
                      key === "full_name" || (key === "school_name" && data.kind === "organisation")
                    }
                  />
                </div>
              ))}
            </div>
            {!copy.showAccountName && (
              <p className="text-xs text-muted-foreground">
                The account holder’s name is retained for account records; this profile is presented
                as the institution.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="member-bio">{copy.aboutLabel}</Label>
              <Textarea
                id="member-bio"
                name="bio"
                maxLength={1500}
                rows={5}
                defaultValue={community?.bio ?? ""}
                placeholder={copy.aboutPlaceholder}
                aria-describedby="member-bio-hint"
              />
              <p id="member-bio-hint" className="text-xs leading-5 text-muted-foreground">
                {copy.aboutHint}
              </p>
            </div>
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="discoverable"
                defaultChecked={community?.discoverable ?? true}
              />
              Show in Discover
            </Label>
            <div className="space-y-1">
              <Label htmlFor="member-visibility">Profile visibility</Label>
              <select
                id="member-visibility"
                name="visibility"
                className="h-10 w-full rounded-md border bg-background px-3"
                defaultValue={community?.visibility ?? "community"}
              >
                <option value="community">Community</option>
                <option value="connections">Connections</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
