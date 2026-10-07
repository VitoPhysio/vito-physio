import { createFileRoute } from '@tanstack/react-router';
import { AthletePortal } from '@/components/athlete/Portal';
export const Route = createFileRoute('/_authenticated/profile')({
  head: () => ({ meta: [{ title: 'Athlete profile — VITO Physio' }, { name: 'description', content: 'Manage your VITO sporting identity and profile picture.' }, { property: 'og:title', content: 'Athlete profile — VITO Physio' }, { property: 'og:description', content: 'Your professional athlete identity within VITO Physio.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Profile,
});
function Profile() { const { user } = Route.useRouteContext(); return <AthletePortal user={user} view="profile" />; }
