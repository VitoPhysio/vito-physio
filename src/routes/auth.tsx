import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoPicker, fileToPhotoPath } from "@/components/vito/Photo";
import { signInWithIdentifier } from "@/lib/auth.functions";
import { useQuery } from "@tanstack/react-query";
import { listOrganisations } from "@/lib/intake.functions";
import { selectClass } from "@/components/vito/SimpleForm";
import logo from "@/assets/vito-logo.png";
import { WhatsAppConsultationButton } from "@/components/vito/WhatsAppConsultationButton";

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
  const orgs = useQuery({ queryKey: ["org-list"], queryFn: () => listOrganisations() });

  async function extra(kind: "reset" | "resend") {
    if (!identifier.includes("@")) {
      setMsg({ kind: "err", text: "Type your email address above first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } =
      kind === "reset"
        ? await supabase.auth.resetPasswordForEmail(identifier.trim(), {
            redirectTo: `${window.location.origin}/reset-password`,
          })
        : await supabase.auth.resend({
            type: "signup",
            email: identifier.trim(),
            options: { emailRedirectTo: `${window.location.origin}/dashboard` },
          });
    setMsg(
      error
        ? {
            kind: "err",
            text: /rate|limit/i.test(error.message)
              ? "Too many emails sent. Please wait a few minutes and try again."
              : error.message,
          }
        : {
            kind: "ok",
            text:
              kind === "reset"
                ? "Check your email for a link to set a new password."
                : "A new confirmation link was sent. Check your inbox and spam folder.",
          },
    );
    setBusy(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signup") {
      let avatar_path: string | null = null;
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const file = fd.get("photo") as File | null;
      const g = (k: string) => String(fd.get(k) ?? "").trim();
      if (g("confirm") !== password) {
        setMsg({ kind: "err", text: "Passwords do not match." });
        setBusy(false);
        return;
      }
      try {
        if (file && file.size) avatar_path = await fileToPhotoPath(file);
      } catch (err) {
        setMsg({ kind: "err", text: err instanceof Error ? err.message : "Photo failed" });
        setBusy(false);
        return;
      }
      const athleteMeta =
        role === "athlete"
          ? {
              first_name: g("first_name"),
              surname: g("surname"),
              full_name: `${g("first_name")} ${g("surname")}`.trim(),
              sport: g("sport"),
              phone: g("phone"),
              date_of_birth: g("date_of_birth"),
              school_id: g("school_id"),
            }
          : {};
      const { error } = await supabase.auth.signUp({
        email: identifier,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            requested_role: role.split(":")[0],
            account_kind: role.includes(":club") ? "club_academy" : null,
            avatar_path,
            ...athleteMeta,
          },
        },
      });

      setMsg(
        error
          ? {
              kind: "err",
              text: /already registered/i.test(error.message)
                ? "This email already has an account. Sign in instead."
                : /rate|limit/i.test(error.message)
                  ? "Too many sign-ups right now. Please wait a few minutes and try again."
                  : error.message,
            }
          : {
              kind: "ok",
              text:
                role === "athlete"
                  ? "Your athlete record will be created automatically. Check your email to verify your account, then sign in."
                  : "Check your email and click the link to verify your account, then sign in.",
            },
      );
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
      <div className="fixed bottom-5 right-5 z-40">
        <WhatsAppConsultationButton compact />
      </div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg">
        <Link to="/" className="mb-4 flex flex-col items-center gap-1">
          <img src={logo} alt="VITO Physio" className="h-16 w-16" />
          <span className="font-bold text-primary">VITO Physio</span>
        </Link>
        <div className="mb-5 grid grid-cols-2 gap-2">
          <Button
            variant={mode === "signin" ? "default" : "outline"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </Button>
          <Button
            variant={mode === "signup" ? "default" : "outline"}
            onClick={() => setMode("signup")}
          >
            Create account
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label>I am a</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <Button
                      key={c.value}
                      type="button"
                      size="sm"
                      variant={role === c.value ? "default" : "outline"}
                      onClick={() => setRole(c.value)}
                    >
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
                  <p className="text-xs text-muted-foreground">
                    Register your club or academy first to get its ID, then link it after signing
                    in.
                  </p>
                )}
              </div>
              {role === "athlete" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="first_name">First name</Label>
                    <Input id="first_name" name="first_name" required maxLength={80} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="surname">Surname</Label>
                    <Input id="surname" name="surname" required maxLength={80} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sport">Sport</Label>
                    <Input id="sport" name="sport" maxLength={80} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dob">Date of birth</Label>
                    <Input id="dob" name="date_of_birth" type="date" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" maxLength={40} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="school_id">
                      School, club or academy (if registered with VITO)
                    </Label>
                    <select id="school_id" name="school_id" className={selectClass}>
                      <option value="">Not listed / none</option>
                      {orgs.data?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.school_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}
              <PhotoPicker />
            </>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">
              {mode === "signin" ? "Email or VITO account ID" : "Email"}
            </Label>
            <Input
              id="email"
              type={mode === "signin" ? "text" : "email"}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                mode === "signin" ? "name@example.com or VITO-ACC-…" : "name@example.com"
              }
              autoComplete="username"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === "signup" && (
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" name="confirm" type="password" required minLength={8} />
            </div>
          )}
          {mode === "signin" && (
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <button
                type="button"
                className="text-primary underline"
                onClick={() => extra("reset")}
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="text-primary underline"
                onClick={() => extra("resend")}
              >
                Resend confirmation email
              </button>
            </div>
          )}
          {msg && (
            <p className={msg.kind === "ok" ? "text-sm text-primary" : "text-sm text-destructive"}>
              {msg.text}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
