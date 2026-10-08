import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, UserRound, Stethoscope, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requestConsultation, listOrganisations } from '@/lib/intake.functions';
import { PhotoPicker, fileToPhotoPath } from '@/components/vito/Photo';
import { selectClass } from '@/components/vito/SimpleForm';

type Mode = 'organisation' | 'athlete' | 'consult';
export const Route = createFileRoute('/register')({
  head: () => ({ meta: [{ title: 'Register or request a consult — VITO Physio' }, { name: 'description', content: 'Register your school, academy, club or athlete with VITO Physio, or request a consultation.' }, { property: 'og:title', content: 'Register or request a consult — VITO Physio' }, { property: 'og:description', content: 'Register an organisation or athlete, or request a VITO Physio consultation.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: RegisterPage,
});
function RegisterPage() {
  const [mode, setMode] = useState<Mode>('organisation');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const orgs = useQuery({ queryKey: ['org-list'], queryFn: () => listOrganisations() });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setResult('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const get = (key: string) => String(fd.get(key) ?? '').trim();
    try {
      const file = fd.get('photo') as File | null;
      const photo = mode !== 'consult' && file && file.size ? { photo_path: await fileToPhotoPath(file) } : {};
      if (mode !== 'consult') {
        if (get('password') !== get('confirm')) throw new Error('Passwords do not match.');
        const avatar = (photo as { photo_path?: string }).photo_path;
        const meta = mode === 'athlete'
          ? { requested_role: 'athlete', full_name: `${get('first_name')} ${get('surname')}`, first_name: get('first_name'), surname: get('surname'), sport: get('sport'), phone: get('phone'), date_of_birth: get('date_of_birth'), school_id: get('school_id'), avatar_path: avatar }
          : { requested_role: 'school_admin', full_name: get('contact_name'), org_name: get('name'), org_type: get('school_type'), org_location: get('location'), phone: get('phone'), org_notes: get('notes'), avatar_path: avatar };
        if (mode === 'organisation' && orgs.data?.some(o => o.name.toLowerCase() === get('name').toLowerCase())) throw new Error('That organisation is already registered with VITO. Sign in, or ask the VITO team to link your account to it.');
        const { error: err } = await supabase.auth.signUp({ email: get('email'), password: get('password'), options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: meta } });
        if (err) throw err;
        setResult(`Almost done! We sent a confirmation link to ${get('email')}. Click it to activate your account — your VITO ${mode === 'athlete' ? 'athlete' : 'organisation'} ID is created automatically and shown on your dashboard.`);
      } else {
        await requestConsultation({ data: { contact_name: get('name'), email: get('email'), phone: get('phone'), organisation_type: get('organisation_type') as 'individual' | 'school' | 'academy' | 'club', message: get('message') } });
        setResult('Your consultation request has been saved. The VITO team can review it.');
      }
      form.reset();
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-background">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5"><h1 className="text-xl font-bold text-primary">VITO Physio</h1><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-2 size-4"/> Home</Link></Button></div></header>
    <main className="mx-auto max-w-3xl px-5 py-9"><h2 className="text-3xl font-bold text-foreground">Register & consult</h2><p className="mt-2 text-muted-foreground">Choose the right path for your visit.</p>
      <div className="mt-6 grid grid-cols-3 gap-2">{([['organisation','School / academy / club',Building2],['athlete','Athlete',UserRound],['consult','Consultation',Stethoscope]] as const).map(([value,label,Icon]) => <Button key={value} type="button" className="h-auto min-h-16 whitespace-normal px-2 text-center text-xs sm:text-sm" variant={mode === value ? 'default' : 'outline'} onClick={() => { setMode(value); setResult(''); setError(''); }}><Icon className="mr-1 size-4 shrink-0"/>{label}</Button>)}</div>
      <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
        {mode === 'athlete' ? <><Field label="First name" name="first_name" required/><Field label="Surname" name="surname" required/><Field label="Sport" name="sport"/><Field label="Date of birth" name="date_of_birth" type="date"/><Field label="Phone" name="phone"/><div className="sm:col-span-2"><Label htmlFor="school_id">Your school, club or academy (if registered with VITO)</Label><select id="school_id" name="school_id" className={`${selectClass} mt-1`}><option value="">Not listed / none</option>{(['school','academy','club'] as const).map(t => <optgroup key={t} label={t === 'academy' ? 'Academies' : `${t[0].toUpperCase()}${t.slice(1)}s`}>{orgs.data?.filter(o => o.school_type === t).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>)}</select></div></> : <>
          <Field label={mode === 'consult' ? 'Your name' : 'Organisation name'} name="name" required/>{mode === 'organisation' && !!orgs.data?.length && <p className="text-xs text-muted-foreground sm:col-span-2">Already registered: {orgs.data.slice(0, 30).map(o => o.name).join(', ')}. If yours is listed, sign in instead.</p>}
          <div><Label htmlFor="organisation_type">{mode === 'consult' ? 'I am contacting as' : 'Organisation type'}</Label><select id="organisation_type" name={mode === 'consult' ? 'organisation_type' : 'school_type'} className={`${selectClass} mt-1`} required>{mode === 'consult' && <option value="individual">Individual</option>}<option value="school">School</option><option value="academy">Academy</option><option value="club">Club</option></select></div>
          {mode === 'consult' ? <><Field label="Email" name="email" type="email" required/><Field label="Phone" name="phone"/><div className="sm:col-span-2"><Label htmlFor="message">What do you need help with?</Label><Textarea id="message" name="message" required minLength={10} maxLength={2000} className="mt-1" rows={4}/></div></> : <><Field label="Location" name="location"/><Field label="Contact phone" name="phone"/><div className="sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" maxLength={1000} className="mt-1" rows={3}/></div></>}
        </>}
        {mode !== 'consult' && <><div className="sm:col-span-2 mt-2 border-t pt-4"><p className="font-semibold">Your sign-in details</p><p className="text-xs text-muted-foreground">You will confirm this email before signing in.</p></div>{mode === 'organisation' && <Field label="Your full name" name="contact_name" required/>}<Field label="Email" name="email" type="email" required/><div /><Field label="Password" name="password" type="password" required/><Field label="Confirm password" name="confirm" type="password" required/></>}
        {mode !== 'consult' && <div className="sm:col-span-2"><PhotoPicker key={mode} label={mode === 'athlete' ? 'Athlete photo' : 'Logo or photo'} /></div>}
        {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
        {result && <p role="status" className="border-l-4 border-accent bg-secondary p-4 font-semibold text-foreground sm:col-span-2">{result}</p>}
        <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : mode === 'consult' ? 'Request consultation' : 'Register'}</Button></div>
      </form><p className="mt-8 text-sm text-muted-foreground">Already registered? <Link to="/auth" className="font-semibold text-primary underline">Sign in or create your account</Link></p>
    </main>
  </div>;
}
function Field({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <div><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} maxLength={type === 'date' ? undefined : 160} minLength={type === 'password' ? 8 : undefined} className="mt-1"/></div>; }
