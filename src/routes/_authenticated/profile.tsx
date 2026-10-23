import { createFileRoute } from '@tanstack/react-router';
import { MemberProfile, memberProfileQuery } from '@/components/vito/MemberProfile';
export const Route = createFileRoute('/_authenticated/profile')({
  loader: ({ context }) => context.queryClient.ensureQueryData(memberProfileQuery(context.user.id)),
  head: () => ({ meta: [{ title: 'My profile — VITO Physio' }, { name: 'description', content: 'Manage your role-specific VITO identity and profile picture.' }, { property: 'og:title', content: 'My profile — VITO Physio' }, { property: 'og:description', content: 'Your sporting, professional or community identity within VITO Physio.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Profile,
});
function Profile() { const { user } = Route.useRouteContext(); return <MemberProfile user={user} />; }
