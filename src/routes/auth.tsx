import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { PhotoPicker, fileToPhotoPath } from "@/components/vito/Photo";
import { setupAthleteIdLogin, signInWithIdentifier } from "@/lib/auth.functions";
import { useQuery } from "@tanstack/react-query";
import { listOrganisations } from "@/lib/intake.functions";
import { selectClass } from "@/components/vito/SimpleForm";
import logo from "@/assets/vito-logo.png";
import { WhatsAppConsultationButton } from "@/components/vito/WhatsAppConsultationButton";
import {
  isPhoneSignInLookupError,
  normalizeAuthPhoneNumber,
  phoneAuthErrorMessage,
} from "@/lib/phone-auth";

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
type PhoneChannel = "sms" | "whatsapp";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInPathway, setSignInPathway] = useState<"email" | "phone" | null>(null);
  const [role, setRole] = useState("athlete");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneChannel, setPhoneChannel] = useState<PhoneChannel>("sms");
  const [phoneStage, setPhoneStage] = useState<"phone" | "code">("phone");
  const [phoneSetup, setPhoneSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [surname, setSurname] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const orgs = useQuery({ queryKey: ["org-list"], queryFn: () => listOrganisations() });
  const showAccountFields = mode === "signup" || signInPathway === "email";

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
    if (mode === "signin" && signInPathway === "phone") {
      try {
        const normalizedPhone = normalizeAuthPhoneNumber(phone);
        if (phoneStage === "phone") {
          if (phoneSetup) {
            if (!identifier.trim() || !password) {
              throw new Error(
                "Enter the email, athlete ID or VITO account ID and password for your existing account.",
              );
            }
            const session = await signInWithIdentifier({
              data: { identifier: identifier.trim(), password },
            });
            if ("needsPassword" in session) {
              throw new Error(
                "Set up your athlete ID password from email sign-in first, then return here to link your phone.",
              );
            }
            const { error: sessionError } = await supabase.auth.setSession(session);
            if (sessionError) throw sessionError;
            const { error: phoneError } = await supabase.auth.updateUser({
              phone: normalizedPhone,
            });
            if (phoneError) throw phoneError;
            setPassword("");
            setMsg({
              kind: "ok",
              text: `A verification code was sent by SMS to ${normalizedPhone}. Enter it below to link this number to your VITO account.`,
            });
          } else {
            const { error } = await supabase.auth.signInWithOtp({
              phone: normalizedPhone,
              options: { shouldCreateUser: false, channel: phoneChannel },
            });
            if (error && !isPhoneSignInLookupError(error.message)) throw error;
            const channelName = phoneChannel === "sms" ? "SMS" : "WhatsApp";
            setMsg({
              kind: "ok",
              text: `If this number is linked to a VITO account, a sign-in code will arrive via ${channelName}. If it does not arrive, choose another sign-in method or set up phone sign-in first.`,
            });
          }
          setPhone(normalizedPhone);
          setPhoneCode("");
          setPhoneStage("code");
        } else {
          const token = phoneCode.trim();
          if (!/^\d{6}$/.test(token)) throw new Error("Enter the six-digit verification code.");
          const { data, error } = await supabase.auth.verifyOtp({
            phone: normalizedPhone,
            token,
            type: phoneSetup ? "phone_change" : "sms",
          });
          if (error) throw error;
          if (!phoneSetup && !data.session)
            throw new Error(
              "The code was accepted, but no sign-in session was returned. Please try again.",
            );
          await navigate({ to: "/" });
        }
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : "Phone sign-in failed.";
        setMsg({ kind: "err", text: phoneAuthErrorMessage(rawMessage, phoneSetup) });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (mode === "signup") {
      let avatar_path: string | null = null;
      const email = identifier.trim().toLowerCase();
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
        email,
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
                  ? "Your athlete record will be created automatically. Check your email and click the confirmation link to verify your account, then sign in. If you selected a school, your school link will remain pending until an administrator approves it."
                  : "Check your email and click the confirmation link to verify your account, then sign in. Any school or organisation access remains pending until an administrator approves it.",
            },
      );
    } else {
      try {
        if (setup) {
          if (password.length < 8) throw new Error("Choose a password of at least 8 characters.");
          const confirm = new FormData(e.currentTarget as HTMLFormElement).get("confirm");
          if (confirm !== password) throw new Error("Passwords do not match.");
        }
        const session = setup
          ? await setupAthleteIdLogin({ data: { code: identifier.trim(), surname, password } })
          : await signInWithIdentifier({ data: { identifier: identifier.trim(), password } });
        if ("needsPassword" in session) {
          setSetup(true);
          setPassword("");
          setMsg({
            kind: "ok",
            text: "Welcome! Your clinician registered this athlete ID. Confirm your surname and create a password to finish setting up your login.",
          });
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.setSession(session);
        if (error) throw error;
        navigate({ to: "/" });
      } catch (error) {
        const text = error instanceof Error ? error.message : "Sign-in failed.";
        setMsg({
          kind: "err",
          text: /not confirmed|email_not_confirmed/i.test(text)
            ? 'Your email is not confirmed yet. Click the confirmation link we emailed you, or use "Resend confirmation email" below.'
            : text,
        });
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
            onClick={() => {
              setMode("signin");
              setSignInPathway(null);
              setPhoneStage("phone");
              setPhoneSetup(false);
              setPassword("");
              setSetup(false);
              setMsg(null);
            }}
          >
            Sign in
          </Button>
          <Button
            variant={mode === "signup" ? "default" : "outline"}
            onClick={() => {
              setMode("signup");
              setSignInPathway(null);
              setPhoneStage("phone");
              setPhoneSetup(false);
              setPassword("");
              setSetup(false);
              setMsg(null);
            }}
          >
            Create account
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signin" && !signInPathway && (
            <div className="space-y-3">
              <div>
                <h1 className="text-lg font-semibold">Choose how to sign in</h1>
                <p className="text-sm text-muted-foreground">Use your existing VITO account.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start px-4 py-4 text-left"
                onClick={() => setSignInPathway("email")}
              >
                <span>
                  <span className="block font-medium">Email or VITO ID</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Continue with your password
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start px-4 py-4 text-left"
                onClick={() => {
                  setSignInPathway("phone");
                  setPhoneStage("phone");
                  setPhoneSetup(false);
                  setMsg(null);
                }}
              >
                <span>
                  <span className="block font-medium">Phone number</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Get a one-time sign-in code
                  </span>
                </span>
              </Button>
            </div>
          )}
          {mode === "signin" && signInPathway === "phone" && (
            <div className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => {
                  setSignInPathway(null);
                  setPhoneStage("phone");
                  setPhoneSetup(false);
                  setPhoneCode("");
                  setMsg(null);
                }}
              >
                ← Choose another sign-in method
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Sign in with your phone</h1>
                <p className="text-sm text-muted-foreground">
                  Enter the international number linked to your VITO account.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone-number">Phone number</Label>
                <Input
                  id="phone-number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={32}
                  value={phone}
                  disabled={phoneStage === "code"}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+256 7xx xxx xxx"
                />
                <p className="text-xs text-muted-foreground">
                  Include the country code, for example +256. Codes are sent by Supabase Auth.
                </p>
              </div>
              {phoneStage === "phone" && !phoneSetup && (
                <div className="space-y-1">
                  <Label htmlFor="phone-channel">Send code by</Label>
                  <select
                    id="phone-channel"
                    className={selectClass}
                    value={phoneChannel}
                    onChange={(event) => setPhoneChannel(event.target.value as PhoneChannel)}
                  >
                    <option value="sms">SMS text message</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    WhatsApp requires Supabase Auth to use Twilio or Twilio Verify with a WhatsApp
                    sender.
                  </p>
                </div>
              )}
              {phoneSetup && phoneStage === "phone" && (
                <>
                  <p className="rounded-md border-l-4 border-primary bg-secondary p-3 text-xs text-foreground">
                    To link this number safely, first confirm your existing VITO account. Supabase
                    sends this linking code by SMS. After verification, you can sign in with SMS or
                    WhatsApp if that delivery channel is configured.
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="phone-link-identifier">
                      Email, athlete ID or VITO account ID
                    </Label>
                    <Input
                      id="phone-link-identifier"
                      type="text"
                      required
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="phone-link-password">Existing account password</Label>
                    <PasswordInput
                      id="phone-link-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                </>
              )}
              {phoneStage === "code" && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="phone-code">Six-digit code</Label>
                    <Input
                      id="phone-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      maxLength={6}
                      value={phoneCode}
                      onChange={(event) =>
                        setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="123456"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0"
                    onClick={() => {
                      setPhoneStage("phone");
                      setPhoneCode("");
                      setMsg(null);
                    }}
                  >
                    Change number or request a new code
                  </Button>
                </>
              )}
              {!phoneSetup && phoneStage === "phone" && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => {
                    setPhoneSetup(true);
                    setPhoneChannel("sms");
                    setIdentifier("");
                    setPassword("");
                    setMsg(null);
                  }}
                >
                  Set up phone sign-in for an existing account
                </Button>
              )}
              {phoneSetup && phoneStage === "phone" && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => {
                    setPhoneSetup(false);
                    setIdentifier("");
                    setPassword("");
                    setMsg(null);
                  }}
                >
                  Back to phone sign-in
                </Button>
              )}
            </div>
          )}
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
                      onClick={() => {
                        if (c.value.startsWith("school_admin")) {
                          void navigate({
                            to: "/register",
                            search: {
                              category: c.value.includes(":club") ? "club" : "school",
                              institution: "",
                            },
                          });
                          return;
                        }
                        setRole(c.value);
                      }}
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
          {showAccountFields && (
            <div className="space-y-1">
              <Label htmlFor="email">
                {mode === "signin" ? "Email, athlete ID or VITO account ID" : "Email"}
              </Label>
              <Input
                id="email"
                type={mode === "signin" ? "text" : "email"}
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setSetup(false);
                }}
                placeholder={
                  mode === "signin" ? "name@example.com or VITO-ATH-…" : "name@example.com"
                }
                autoComplete="username"
              />
            </div>
          )}
          {showAccountFields && (
            <div className="space-y-1">
              <Label htmlFor="pw">Password</Label>
              <PasswordInput
                id="pw"
                required
                minLength={mode === "signup" || setup ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" || setup ? "new-password" : "current-password"}
              />
            </div>
          )}
          {mode === "signin" && setup && (
            <div className="space-y-1">
              <Label htmlFor="surname">Surname</Label>
              <Input
                id="surname"
                required
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />
            </div>
          )}
          {(mode === "signup" || setup) && (
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirm password</Label>
              <PasswordInput
                id="confirm"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          )}
          {mode === "signin" && signInPathway === "email" && (
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
          {(mode === "signup" || signInPathway !== null) && (
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : signInPathway === "phone"
                    ? phoneStage === "code"
                      ? "Verify code"
                      : phoneSetup
                        ? "Verify account and send SMS"
                        : `Send ${phoneChannel === "sms" ? "SMS" : "WhatsApp"} code`
                    : "Sign in"}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
