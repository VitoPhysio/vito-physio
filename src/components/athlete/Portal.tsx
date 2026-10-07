import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowUpRight, CalendarDays, Compass, Dumbbell, FileText, HeartPulse, Home, LockKeyhole, MessageSquare, Plus, Search, ShieldCheck, Trophy, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { EditablePhoto, PhotoAvatar } from '@/components/vito/Photo';
import { Inbox } from '@/components/vito/Communications';
import { supabase } from '@/integrations/supabase/client';
import { contactClinician, reportInjury } from '@/lib/athlete.functions';
import { STAGE_LABEL, stageProgress, useHealth, useViewer } from './data';
import logo from '@/assets/vito-logo.png';

type View = 'home' | 'discover' | 'profile';
type HomeSection = 'overview' | 'register' | 'actions' | 'connections' | 'recovery' | 'updates' | 'activity';
type Tool = 'injuries' | 'rehab' | 'assessments' | 'appointments' | 'reports' | 'messages' | 'report' | 'contact' | 'notifications';
const tools: { key: Tool; label: string; icon: typeof HeartPulse }[] = [
  { key: 'report', label: 'Register new case', icon: Plus }, { key: 'injuries', label: 'My injuries', icon: HeartPulse },
  { key: 'rehab', label: 'Rehabilitation', icon: Dumbbell }, { key: 'assessments', label: 'Assessments', icon: ShieldCheck },
  { key: 'contact', label: 'Contact clinician', icon: MessageSquare }, { key: 'appointments', label: 'Appointments', icon: CalendarDays },
  { key: 'reports', label: 'Reports & history', icon: FileText }, { key: 'notifications', label: 'Care updates', icon: Activity },
];
const date = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not scheduled';
const homeSections: { key: HomeSection; label: string }[] = [
  { key: 'overview', label: 'For you' },
  { key: 'register', label: 'Register new case' },
  { key: 'actions', label: 'Quick actions' },
  { key: 'connections', label: 'Connections' },
  { key: 'recovery', label: 'Recovery tracking' },
  { key: 'updates', label: 'Care updates' },
  { key: 'activity', label: 'Sporting activity' },
];

export function AthletePortal({ user, view = 'home' }: { user: User; view?: View }) {
  const viewer = useViewer(user);
  const health = useHealth(user.id);
  const qc = useQueryClient();
  const [tool, setTool] = useState<Tool | null>(null);
  const [homeSection, setHomeSection] = useState<HomeSection>('overview');
  const [category, setCategory] = useState('Athletes');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const h = health.data;
  const v = viewer.data;
  const athlete = h?.athletes[0];
  const documents = useQuery({ queryKey: ['athlete-documents', user.id], enabled: tool === 'reports' && !!h?.athletes.length, queryFn: async () => {
    const ids = h?.athletes.map(a => a.id) ?? [];
    const { data, error } = await supabase.from('documents').select('id, title, storage_path, created_at').in('athlete_id', ids);
    if (error) throw error; return data ?? [];
  }});
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true);
    try {
      if (tool === 'report') {
        const id = String(form.get('athlete'));
        if (!id) throw new Error('Link your athlete record first.');
        const code = await reportInjury({ data: { athlete_id: id, body_region: String(form.get('region')), mechanism: String(form.get('mechanism')), injury_date: String(form.get('date')) || undefined, pain_score: Number(form.get('pain')), notes: String(form.get('body')) } });
        toast.success(`Injury reported: ${code}`);
      } else {
        await contactClinician({ data: { athlete_id: String(form.get('athlete')) || undefined, kind: String(form.get('kind')) as 'message' | 'appointment' | 'consultation' | 'follow_up', body: String(form.get('body')) } });
        toast.success('Sent to the VITO clinical team');
      }
      qc.invalidateQueries({ queryKey: ['athlete-health', user.id] }); qc.invalidateQueries({ queryKey: ['inbox', user.id] }); setTool(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-background pb-24 sm:pb-8">
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-7 pb-28 sm:px-5">
      {view === 'home' && <>
        <section id="for-you" aria-labelledby="for-you-title" className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Athlete portal</p>
          <h1 id="for-you-title" className="text-3xl font-bold tracking-tight">For you</h1>
        </section>
        {health.isError && <div role="alert" className="flex items-center justify-between gap-3 border-l-4 border-destructive bg-card p-4"><p>Health records could not be loaded.</p><Button variant="outline" onClick={() => health.refetch()}>Retry</Button></div>}
        {!health.isLoading && h && !h.linked && <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-accent bg-card p-4"><p className="text-sm">No athlete record linked to this account.</p><Button asChild variant="outline"><Link to="/link-account">Link athlete record<ArrowUpRight className="size-4" /></Link></Button></div>}
        <section aria-label="For you sections" className="space-y-5">
          <div role="tablist" aria-label="For you sections" className="flex gap-2 overflow-x-auto border-b pb-3">
            {homeSections.map(section => <Button key={section.key} role="tab" aria-selected={homeSection === section.key} aria-controls={`home-panel-${section.key}`} variant={homeSection === section.key ? 'default' : 'outline'} className="shrink-0" onClick={() => setHomeSection(section.key)}>{section.label}</Button>)}
          </div>
          <div id={`home-panel-${homeSection}`} role="tabpanel" aria-label={homeSections.find(section => section.key === homeSection)?.label} className="space-y-8">
            {homeSection === 'overview' && <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex items-start justify-between gap-5 border-b bg-secondary/50 p-5 sm:p-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your care at a glance</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Health & injury overview</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Keep track of your current health, recovery plan, appointments, and clinical assessments in one place.</p></div><div className="hidden rounded-2xl bg-primary/10 p-3 text-primary sm:block"><HeartPulse className="size-7" /></div></div><div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              <Summary label="Current injuries" value={health.isLoading ? '…' : String(h?.active.length ?? 0)} detail={h?.active[0]?.body_region || 'No active injury recorded'} icon={HeartPulse} onClick={() => setTool('injuries')} />
              <Summary label="Rehabilitation" value={health.isLoading ? '…' : String(h?.rehab.filter(p => h.active.some(i => i.id === p.injury_id)).length ?? 0)} detail={h?.rehab[0]?.phase || 'Plans & prescribed exercises'} icon={Dumbbell} onClick={() => setTool('rehab')} />
              <Summary label="Next appointment" value={h?.upcoming[0] ? date(h.upcoming[0].scheduled_at) : 'Not scheduled'} detail={h?.upcoming[0]?.purpose || 'Appointments & follow-ups'} icon={CalendarDays} onClick={() => setTool('appointments')} />
              <Summary label="Assessments" value={health.isLoading ? '…' : String(h?.assessments.length ?? 0)} detail="Your assessment summaries" icon={ShieldCheck} onClick={() => setTool('assessments')} />
            </div></section>}
            {homeSection === 'register' && <section className="rounded-xl border bg-card p-6 shadow-sm"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Start a care record</p><h2 className="mt-2 text-2xl font-bold">Register a new case</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Tell the VITO clinical team about a new injury or concern. Your report will be added to your care workspace for review.</p><Button className="mt-5" onClick={() => setTool('report')}><Plus className="size-4" />Register new case</Button>{!h?.linked && <p className="mt-3 text-xs text-muted-foreground">Link your athlete record before submitting a case.</p>}</div></section>}
            {homeSection === 'actions' && <section><Heading title="Quick actions" icon={Activity} /><div className="flex flex-wrap gap-2">{tools.map(t => <Button key={t.key} variant="outline" className="h-auto min-h-11 justify-start whitespace-normal bg-card py-3" onClick={() => setTool(t.key)}><t.icon className="size-4 shrink-0 text-primary" />{t.label}</Button>)}</div></section>}
            {homeSection === 'connections' && <div className="grid gap-8 lg:grid-cols-2"><section><Heading title="My clinical team" icon={LockKeyhole} />{h?.careTeam.length ? h.careTeam.map(c => <div key={c.id} className="mb-3 flex items-center gap-3"><PhotoAvatar name={c.name} /><span className="text-sm font-medium">{c.name}</span></div>) : <Empty icon={LockKeyhole} text="Your clinical team will appear here." />}<div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setTool('contact')}><MessageSquare className="size-4" />Contact clinician</Button><Button variant="outline" onClick={() => setTool('messages')}>Messages</Button></div></section><section><Heading title="My network" icon={Users} /><Empty icon={Users} text="No connections to display." /><Button asChild variant="outline"><Link to="/discover">Discover the VITO community<ArrowUpRight className="size-4" /></Link></Button></section></div>}
            {homeSection === 'recovery' && <section><Heading title="Recovery tracking" icon={Activity} />{!!h?.active.length ? <div className="grid gap-3 sm:grid-cols-2">{h.active.map(i => <Button key={i.id} variant="outline" className="h-auto flex-col items-stretch gap-3 bg-card p-4 text-left" onClick={() => setTool('injuries')}><span className="flex justify-between gap-2"><span className="font-semibold">{i.body_region}</span><span className="text-xs text-primary">{STAGE_LABEL[i.status] ?? i.status}</span></span><Progress value={stageProgress(i.status)} /><span className="text-xs text-muted-foreground">{i.injury_code}</span></Button>)}</div> : <Empty icon={Activity} text="No recovery tracking available yet." />}</section>}
            {homeSection === 'updates' && <section><Heading title="Care updates" icon={Activity} />{h?.timeline.length ? <ul className="divide-y border-y">{h.timeline.slice(0, 8).map(t => <li key={t.id} className="flex gap-3 py-4"><span className="mt-1 size-2 shrink-0 rounded-full bg-accent" /><div><p className="text-sm font-medium">{t.title}</p><p className="mt-1 text-xs text-muted-foreground">{date(t.at)}</p></div></li>)}</ul> : <Empty icon={Activity} text="No care updates yet." />}</section>}
            {homeSection === 'activity' && <section><Heading title="Sporting activity" icon={Trophy} /><Empty icon={Trophy} text="No sporting updates yet." /></section>}
          </div>
        </section>
      </>}
      {view === 'discover' && <><div><p className="text-xs font-semibold uppercase text-accent">Professional sports network</p><h1 className="mt-1 text-3xl font-bold">Discover</h1></div><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search sports community" placeholder="Search by name, sport or team" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} /></div><select aria-label="Sport filter" className="rounded-md border bg-card px-3 py-2 text-sm"><option>All sports</option><option>Football</option><option>Athletics</option><option>Basketball</option><option>Rugby</option></select></div><div role="tablist" aria-label="Discover categories" className="flex flex-wrap gap-2">{['Athletes','Schools','Coaches','Opportunities'].map(c => <Button key={c} role="tab" aria-selected={category === c} variant={category === c ? 'default' : 'outline'} onClick={() => setCategory(c)}>{c}</Button>)}</div><section><Heading title={category} icon={category === 'Opportunities' ? Trophy : Users} /><Empty icon={category === 'Opportunities' ? Trophy : Users} text={query ? `No ${category.toLowerCase()} found for “${query}”.` : `No ${category.toLowerCase()} listed yet.`} />{category === 'Opportunities' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{['Trials','Competitions','Training programmes','Scholarships','Teams','Recruitment'].map(c => <div key={c} className="rounded-lg border bg-card p-4"><Trophy className="mb-3 size-5 text-accent" /><h3 className="text-sm font-semibold">{c}</h3><p className="mt-1 text-xs text-muted-foreground">No listings</p></div>)}</div>}</section></>}
      {view === 'profile' && <>
        <section><div className="flex h-40 items-center justify-end overflow-hidden border-b-4 border-accent bg-secondary px-6 sm:h-48"><img src={logo} alt="VITO Physio" className="size-28 object-contain opacity-80" /></div><div className="flex flex-wrap items-start justify-between gap-4 pt-5"><div className="flex items-center gap-4"><PhotoAvatar path={v?.avatar} name={v?.name} className="size-20 border-4 border-card" /><div><h1 className="text-2xl font-bold">{v?.name || 'Athlete profile'}</h1><p className="mt-1 text-sm text-muted-foreground">{athlete?.sport || 'Athlete'} · VITO Physio</p></div></div><Button variant="outline" onClick={() => setEditing(true)}><UserRound className="size-4" />Edit profile</Button></div></section>
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]"><div className="space-y-7"><section><Heading title="Sporting identity" icon={UserRound} /><dl className="grid grid-cols-2 gap-5 text-sm">{[['Sport',athlete?.sport],['Position / event',null],['School / team',null],['Sporting interests',null]].map(([k,val]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{val || 'Not added'}</dd></div>)}</dl></section><section><Heading title="Biography" icon={FileText} /><p className="text-sm text-muted-foreground">No biography added.</p></section><section><Heading title="Achievements & skills" icon={Trophy} /><Empty icon={Trophy} text="No achievements or skills added." /></section><section><Heading title="Sporting photos" icon={UserRound} /><Empty icon={UserRound} text="No sporting photos added." /></section></div><div className="space-y-7"><section><Heading title="Connections" icon={Users} /><Empty icon={Users} text="No connections to display." /></section><section><Heading title="Activity" icon={Activity} /><Empty icon={Activity} text="No sporting updates yet." /></section></div></div>
      </>}
    </main>
    <nav aria-label="Athlete navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 shadow-[0_-8px_24px_-18px_rgba(40,20,80,0.45)] backdrop-blur">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-3 items-center px-4 py-2">
        {([{ to: '/dashboard', label: 'Home', icon: Home, key: 'home', position: 'justify-self-start' }, { to: '/discover', label: 'Discover', icon: Compass, key: 'discover', position: 'justify-self-center' }, { to: '/profile', label: 'Profile', icon: UserRound, key: 'profile', position: 'justify-self-end' }] as const).map(n => <Link key={n.key} to={n.to} aria-label={n.label} title={n.label} aria-current={view === n.key ? 'page' : undefined} className={`${n.position} flex size-12 items-center justify-center rounded-xl transition-colors ${view === n.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><n.icon className="size-5" /></Link>)}
      </div>
    </nav>
    <Dialog open={editing} onOpenChange={setEditing}><DialogContent><DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader><EditablePhoto path={v?.avatar ?? null} name={v?.name ?? null} target="profile" targetId={user.id} onUpdated={() => { qc.invalidateQueries({ queryKey: ['viewer', user.id] }); qc.invalidateQueries({ queryKey: ['app-header', user.id] }); }} /><form className="space-y-3" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); const { error } = await supabase.from('profiles').update({ full_name: String(f.get('name')).trim() }).eq('id', user.id); setBusy(false); if (error) toast.error('Profile could not be saved.'); else { toast.success('Profile updated'); qc.invalidateQueries({ queryKey: ['viewer', user.id] }); qc.invalidateQueries({ queryKey: ['app-header', user.id] }); setEditing(false); } }}><Label htmlFor="profile-name">Name</Label><Input id="profile-name" name="name" required maxLength={120} defaultValue={v?.name} /><Button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</Button></form></DialogContent></Dialog>
    <Dialog open={tool !== null} onOpenChange={open => { if (!open) setTool(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{tool === 'messages' ? 'Private clinical messages' : tools.find(t => t.key === tool)?.label}</DialogTitle></DialogHeader>
      {(tool === 'report' || tool === 'contact') && <form className="space-y-4" onSubmit={submit}>
        <Label htmlFor="athlete-record">Athlete record</Label><select id="athlete-record" name="athlete" className="w-full rounded-md border bg-background p-2" required={tool === 'report'}><option value="">{tool === 'report' ? 'Choose athlete' : 'General enquiry'}</option>{h?.athletes.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.surname}</option>)}</select>
        {tool === 'report' ? <><Label htmlFor="region">Body region</Label><Input id="region" name="region" required minLength={2} maxLength={120} /><Label htmlFor="injury-date">Injury date</Label><Input id="injury-date" name="date" type="date" /><Label htmlFor="mechanism">What happened?</Label><Input id="mechanism" name="mechanism" maxLength={500} /><Label htmlFor="pain">Pain score (0–10)</Label><Input id="pain" name="pain" type="number" min={0} max={10} defaultValue={0} /></> : <><Label htmlFor="request-kind">Request type</Label><select id="request-kind" name="kind" className="w-full rounded-md border bg-background p-2"><option value="message">Message</option><option value="appointment">Appointment request</option><option value="consultation">Consultation request</option><option value="follow_up">Follow-up request</option></select></>}
        <Label htmlFor="message-body">{tool === 'report' ? 'Additional details' : 'Message to clinical team'}</Label><Textarea id="message-body" name="body" required={tool === 'contact'} minLength={tool === 'contact' ? 2 : undefined} maxLength={tool === 'report' ? 1500 : 4000} /><Button type="submit" disabled={busy || (tool === 'report' && !h?.linked)}>{busy ? 'Sending…' : tool === 'report' ? 'Register case' : 'Send request'}</Button>{!h?.linked && tool === 'report' && <Button asChild variant="outline"><Link to="/link-account">Link athlete record</Link></Button>}
      </form>}
      {tool === 'messages' && <Inbox userId={user.id} />}
      {tool === 'injuries' && <div className="space-y-4">{h?.injuries.map(i => <article key={i.id} className="border-b pb-4"><h3 className="font-semibold">{i.body_region} · {i.injury_code}</h3><p className="my-2 text-sm text-primary">{STAGE_LABEL[i.status] ?? i.status}</p><Progress value={stageProgress(i.status)} /><p className="mt-2 text-sm text-muted-foreground">{date(i.injury_date)} · Pain: {i.pain_score ?? 'Not recorded'}/10</p>{i.mechanism && <p className="mt-2 text-sm">{i.mechanism}</p>}{h.recovery.filter(r => r.injury_id === i.id).map(r => <p key={r.id} className="mt-2 text-sm">{date(r.created_at)} · {STAGE_LABEL[r.status] ?? r.status}{r.notes ? ` — ${r.notes}` : ''}</p>)}</article>)}{!h?.injuries.length && <Empty icon={HeartPulse} text="No injuries recorded." />}</div>}
      {tool === 'rehab' && <div className="space-y-5">{h?.rehab.map(p => <article key={p.id} className="border-b pb-4"><h3 className="font-semibold">{p.plan_code} · {p.phase || 'Rehabilitation plan'}</h3><p className="my-2 text-sm">{p.goals}</p><p className="text-xs text-muted-foreground">Target return: {date(p.target_return_date)}</p>{p.notes && <p className="mt-2 text-sm">{p.notes}</p>}</article>)}{h?.exercises.map(e => <article key={e.id} className="border-b pb-3"><h3 className="font-semibold">{e.name}</h3><p className="text-sm">{e.sets ?? '—'} sets · {e.reps || '—'} reps · {e.frequency}</p><p className="mt-1 text-sm text-muted-foreground">{e.instructions}</p></article>)}{!h?.rehab.length && !h?.exercises.length && <Empty icon={Dumbbell} text="No rehabilitation prescribed yet." />}</div>}
      {tool === 'assessments' && <>{h?.assessments.map(a => <article key={a.id} className="border-b py-3"><h3 className="font-semibold">{a.assessment_type || 'Injury assessment'} · {a.assessment_code}</h3><p className="text-sm">Assessed: {date(a.assessment_date)}</p><p className="text-sm text-muted-foreground">Follow-up: {date(a.follow_up_date)}</p></article>)}{!h?.assessments.length && <Empty icon={ShieldCheck} text="No assessment summaries yet." />}</>}
      {tool === 'appointments' && <><Button variant="outline" onClick={() => setTool('contact')}><Plus className="size-4" />Request appointment</Button>{h?.appointments.map(a => <article key={a.id} className="border-b py-3"><h3 className="font-semibold">{a.purpose || 'Clinical appointment'}</h3><p className="text-sm">{new Date(a.scheduled_at).toLocaleString()} · {a.status}</p><p className="text-sm text-muted-foreground">{a.location}</p></article>)}{h?.dueFollowUps.map((f,i) => <p key={i} className="border-b py-3 text-sm">{f.source} · {date(f.date)}</p>)}{!h?.appointments.length && !h?.dueFollowUps.length && <Empty icon={CalendarDays} text="No appointments or follow-ups scheduled." />}</>}
      {tool === 'notifications' && <>{h?.timeline.map(t => <p key={t.id} className="border-b py-3 text-sm">{t.title} · {date(t.at)}</p>)}{!h?.timeline.length && <Empty icon={Activity} text="No care updates yet." />}</>}
      {tool === 'reports' && <div className="athlete-print-summary space-y-3"><Button variant="outline" onClick={() => window.print()}><FileText className="size-4" />Print health summary</Button><div className="space-y-3 text-sm"><h3 className="font-semibold">{athlete ? `${athlete.first_name} ${athlete.surname}` : v?.name}</h3>{h?.injuries.map(i => <p key={i.id}>{i.injury_code} · {i.body_region} · {STAGE_LABEL[i.status] ?? i.status} · {date(i.injury_date)}</p>)}{h?.followUps.map(f => <article key={f.id}><h4 className="font-medium">Review · {date(f.review_date)}</h4><p>{f.progress}</p><p>{f.next_steps}</p></article>)}</div><h3 className="font-semibold">Documents</h3>{documents.isError && <p role="alert">Documents could not be loaded.</p>}{documents.data?.map(d => <Button key={d.id} variant="outline" onClick={async () => { const { data, error } = await supabase.storage.from('case-documents').createSignedUrl(d.storage_path, 60); if (error || !data) toast.error('Document could not be opened.'); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); }}><FileText className="size-4" />{d.title}</Button>)}{!documents.isLoading && !documents.data?.length && !documents.isError && <Empty icon={FileText} text="No documents available." />}</div>}
    </DialogContent></Dialog>
  </div>;
}
function Heading({ title, icon: Icon }: { title: string; icon: typeof HeartPulse }) { return <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Icon className="size-5 text-primary" />{title}</h2>; }
function Empty({ icon: Icon, text }: { icon: typeof HeartPulse; text: string }) { return <div className="flex min-h-28 items-center gap-3 py-6 text-sm text-muted-foreground"><Icon className="size-7 shrink-0 text-muted-foreground/60" /><p>{text}</p></div>; }
function Summary({ label, value, detail, icon: Icon, onClick }: { label: string; value: string; detail: string; icon: typeof HeartPulse; onClick: () => void }) { return <Button variant="outline" onClick={onClick} className="h-full min-h-36 flex-col items-stretch justify-start gap-3 whitespace-normal bg-card p-4 text-left"><span className="flex items-center justify-between text-xs font-medium text-muted-foreground">{label}<Icon className="size-4 text-accent" /></span><span className="text-xl font-bold text-foreground">{value}</span><span className="text-xs font-normal text-muted-foreground">{detail}</span></Button>; }
