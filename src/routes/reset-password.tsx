import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — VITO Physio" }, { name: "description", content: "Choose a new password for your VITO Physio account." }, { property: "og:title", content: "Set a new password — VITO Physio" }, { property: "og:description", content: "Choose a new password for your VITO Physio account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("pw")), confirm = String(f.get("confirm"));
    if (pw !== confirm) { setMsg("Passwords do not match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg(/session/i.test(error.message) ? "This reset link has expired. Request a new one from the sign-in page." : error.message); return; }
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-lg">
        <h1 className="text-xl font-bold text-primary">Set a new password</h1>
        <div className="space-y-1"><Label htmlFor="pw">New password</Label><Input id="pw" name="pw" type="password" required minLength={8} /></div>
        <div className="space-y-1"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" required minLength={8} /></div>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </div>
  );
}
