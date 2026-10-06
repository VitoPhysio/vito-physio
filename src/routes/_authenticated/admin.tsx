import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhotoAvatar } from '@/components/vito/Photo';
import { listAccounts, approveAccount, removeAccount } from '@/lib/admin.functions';

export const Route = createFileRoute('/_authenticated/admin')({
  head: () => ({ meta: [{ title: 'Accounts & approvals — VITO Physio' }, { name: 'description', content: 'Review and manage registered VITO Physio accounts.' }, { property: 'og:title', content: 'Accounts & approvals — VITO Physio' }, { property: 'og:description', content: 'Review and manage registered VITO Physio accounts.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AdminPage,
});

const LABEL: Record<string, string> = { super_admin: 'Super admin', vito_admin: 'VITO admin', clinical_professional: 'Clinician', clinical_supervisor: 'Clinical supervisor', school_admin: 'School / club admin', coach: 'Coach', athlete: 'Athlete', parent: 'Parent / guardian' };

function AdminPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAccounts), approve = useServerFn(approveAccount), remove = useServerFn(removeAccount);
  const { data, error, isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => list() });
  const [q, setQ] = useState('');
  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ['accounts'] }); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  }
  if (error) return <p className="p-8 text-destructive">Only VITO admins can view this page.</p>;
  if (isLoading || !data) return <p className="p-8 text-muted-foreground">Loading…</p>;
  const pending = data.accounts.filter((a) => a.requested_role === 'vito_admin' || a.requested_role === 'clinical_professional');
  const shown = data.accounts.filter((a) => `${a.full_name} ${a.email} ${a.account_code} ${a.role}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand-gradient text-primary-foreground"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><h1 className="text-xl font-bold">Accounts & approvals</h1><Button asChild variant="secondary" size="sm"><Link to="/dashboard"><ArrowLeft className="mr-1 size-4" />Dashboard</Link></Button></div></header>
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        <section>
          <h2 className="mb-3 text-lg font-bold">Pending staff requests ({pending.length})</h2>
          {pending.length ? <ul className="space-y-2">{pending.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-accent bg-card p-3">
              <span className="flex items-center gap-3"><PhotoAvatar path={a.avatar_path} name={a.full_name} /><span><b>{a.full_name ?? '—'}</b><br /><span className="text-xs text-muted-foreground">{a.email} · wants {LABEL[a.requested_role!]}</span></span></span>
              <span className="flex gap-2"><Button size="sm" onClick={() => run(() => approve({ data: { userId: a.id, approve: true } }), 'Approved')}>Approve</Button><Button size="sm" variant="outline" onClick={() => run(() => approve({ data: { userId: a.id, approve: false } }), 'Declined')}>Decline</Button></span>
            </li>))}</ul> : <p className="text-sm text-muted-foreground">No pending requests.</p>}
        </section>
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Registered accounts ({data.accounts.length})</h2><Input placeholder="Search name, email, ID or role" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" /></div>
          <ul className="space-y-2">{shown.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
              <span className="flex items-center gap-3"><PhotoAvatar path={a.avatar_path} name={a.full_name} /><span><b>{a.full_name ?? '—'}</b><br /><span className="text-xs text-muted-foreground">{a.email} · {a.account_code} · joined {new Date(a.created_at).toLocaleDateString()}</span></span></span>
              <span className="flex items-center gap-2"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{LABEL[a.role] ?? a.role}</span>
                {a.id !== data.me && a.role !== 'super_admin' && <Button size="sm" variant="destructive" onClick={() => confirm(`Remove ${a.email}? This cannot be undone.`) && run(() => remove({ data: { userId: a.id } }), 'Account removed')}>Remove</Button>}
              </span>
            </li>))}</ul>
        </section>
      </main>
    </div>
  );
}
