import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoPicker, fileToPhotoPath } from "@/components/vito/Photo";
import { signInWithIdentifier } from "@/lib/auth.functions";
import logo from "@/assets/vito-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — VITO Physio" },
      { name: "description", content: "Sign in or create your VITO Physio account." },
      { property: "og:title", content: "Sign in — VITO Physio" },
      { property: "og:description", content: "Sign in or create your VITO Physio account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const CATEGORIES = [
  { value: "vito_admin", label: "VITO admin" },
  { value: "clinical_professional", label: "Clinician" },
  { value: "school_admin", label: "School admin" },
  { value: "school_admin:club", label: "Club / academy admin" },
  { value: "coach", label: "Coach" },
  { value: "athlete", label: "Athlete" },
  { value: "parent", label: "Parent / guardian" },
];
const NEEDS_APPROVAL = ["vito_admin", "clinical_professional"];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState("athlete");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signup") {
      let avatar_path: string | null = null;
      const file = new FormData(e.currentTarget as HTMLFormElement).get("photo") as File | null;
      try { if (file && file.size) avatar_path = await fileToPhotoPath(file); } catch (err) { setMsg({ kind: "err", text: err instanceof Error ? err.message : "Photo failed" }); setBusy(false); return; }
      const { error } = await supabase.auth.signUp({
        email: identifier,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName, requested_role: role.split(":")[0], account_kind: role.includes(":club") ? "club_academy" : null, avatar_path },
        },
      });
      setMsg(error ? { kind: "err", text: error.message } : { kind: "ok", text: "Check your email and click the link to verify your account, then sign in." });
    } else {
      try {
        const session = await signInWithIdentifier({ data: { identifier, password } });
        const { error } = await supabase.auth.setSession(session);
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } catch (error) {
        setMsg({ kind: "err", text: error instanceof Error ? error.message : "Sign-in failed." });
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg">
        <Link to="/" className="mb-4 flex flex-col items-center gap-1">
          <img src={logo} alt="VITO Physio" className="h-16 w-16" />
          <span className="font-bold text-primary">VITO Physio</span>
        </Link>
        <div className="mb-5 grid grid-cols-2 gap-2">
          <Button variant={mode === "signin" ? "default" : "outline"} onClick={() => setMode("signin")}>Sign in</Button>
          <Button variant={mode === "signup" ? "default" : "outline"} onClick={() => setMode("signup")}>Create account</Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label>I am a</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <Button key={c.value} type="button" size="sm" variant={role === c.value ? "default" : "outline"} onClick={() => setRole(c.value)}>
                      {c.label}
                    </Button>
                  ))}
                </div>
                {NEEDS_APPROVAL.includes(role) && (
                  <p className="rounded-md border-l-4 border-accent bg-secondary p-2 text-xs text-foreground">
                    Staff access is granted only after the VITO super admin approves your request.
                  </p>
                )}
                {role === "school_admin:club" && (
                  <p className="text-xs text-muted-foreground">Register your club or academy first to get its ID, then link it after signing in.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <PhotoPicker />
            </>
          )}
          <div className="space-y-1">
              <Label htmlFor="email">{mode === "signin" ? "Email or VITO account ID" : "Email"}</Label>
              <Input id="email" type={mode === "signin" ? "text" : "email"} required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={mode === "signin" ? "name@example.com or VITO-ACC-…" : "name@example.com"} autoComplete="username" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg && <p className={msg.kind === "ok" ? "text-sm text-primary" : "text-sm text-destructive"}>{msg.text}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
