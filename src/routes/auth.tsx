import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/vito-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — VITO Physio" },
      { name: "description", content: "Sign in or create your VITO Physio account." },
      { property: "og:title", content: "Sign in — VITO Physio" },
      { property: "og:description", content: "Sign in or create your VITO Physio account." },
    ],
  }),
  component: AuthPage,
});

const CATEGORIES = [
  { value: "clinical_professional", label: "Clinician" },
  { value: "school_admin", label: "School admin" },
  { value: "coach", label: "Coach" },
  { value: "athlete", label: "Athlete" },
  { value: "parent", label: "Parent / guardian" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState("athlete");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName, requested_role: role },
        },
      });
      setMsg(error ? { kind: "err", text: error.message } : { kind: "ok", text: "Check your email and click the link to verify your account, then sign in." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ kind: "err", text: error.message.includes("confirmed") ? "Please verify your email first — check your inbox for the link." : error.message });
      else navigate({ to: "/dashboard" });
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg">
        <Link to="/" className="mb-4 flex flex-col items-center gap-1">
          <img src={logo.url} alt="VITO Physio" className="h-16 w-16" />
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
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
