import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker, fileToPhotoPath } from "@/components/vito/Photo";
import { parseSports } from "@/lib/institution";

export type InstitutionFormValues = {
  name: string;
  type: string;
  location: string;
  district: string;
  sports: string[];
  phone: string;
  email: string;
  notes: string;
  logoPath: string | null;
};

export type InstitutionDefaults = Partial<Omit<InstitutionFormValues, "sports">> & { sports?: string[] };

/** Shared form for registering or editing an institution profile. */
export function InstitutionForm({
  defaults,
  mode,
  submitLabel,
  onSubmit,
}: {
  defaults?: InstitutionDefaults;
  mode: "register" | "edit";
  submitLabel: string;
  onSubmit: (values: InstitutionFormValues) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    setBusy(true);
    try {
      const file = form.get("logo");
      const logoPath = file instanceof File && file.size > 0 ? await fileToPhotoPath(file) : null;
      await onSubmit({
        name: text("name"),
        type: text("type") || defaults?.type || "school",
        location: text("location"),
        district: text("district"),
        sports: parseSports(text("sports")),
        phone: text("phone"),
        email: text("email"),
        notes: text("notes"),
        logoPath,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="inst-name">Institution name</Label>
        <Input id="inst-name" name="name" required minLength={3} maxLength={160} defaultValue={defaults?.name} />
      </div>
      {mode === "register" && (
        <div className="grid gap-1.5">
          <Label htmlFor="inst-type">Category</Label>
          <select
            id="inst-type"
            name="type"
            defaultValue={defaults?.type ?? "school"}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="school">School</option>
            <option value="club">Club</option>
            <option value="academy">Academy</option>
          </select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="inst-location">Location</Label>
        <Input id="inst-location" name="location" maxLength={160} defaultValue={defaults?.location} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inst-district">District</Label>
        <Input id="inst-district" name="district" maxLength={120} defaultValue={defaults?.district} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inst-sports">Sports disciplines</Label>
        <Input
          id="inst-sports"
          name="sports"
          placeholder="Football, Netball, Athletics"
          defaultValue={defaults?.sports?.join(", ")}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inst-phone">Contact phone</Label>
        <Input id="inst-phone" name="phone" type="tel" maxLength={40} defaultValue={defaults?.phone} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inst-email">Contact email</Label>
        <Input id="inst-email" name="email" type="email" maxLength={160} defaultValue={defaults?.email} />
      </div>
      {mode === "register" && (
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="inst-notes">Administrator details and notes</Label>
          <Textarea
            id="inst-notes"
            name="notes"
            maxLength={1000}
            placeholder="Administrator name, title, and anything VITO should know for verification"
          />
        </div>
      )}
      <div className="sm:col-span-2">
        <PhotoPicker name="logo" label="Institution logo" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="bg-brand-gradient">
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
