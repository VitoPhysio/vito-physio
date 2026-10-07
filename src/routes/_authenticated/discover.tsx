import { createFileRoute } from '@tanstack/react-router';
import { AthletePortal } from '@/components/athlete/Portal';
export const Route = createFileRoute('/_authenticated/discover')({
  head: () => ({ meta: [{ title: 'Discover sports community — VITO Physio' }, { name: 'description', content: 'Explore athletes, schools, coaches and sporting opportunities in the VITO community.' }, { property: 'og:title', content: 'Discover sports community — VITO Physio' }, { property: 'og:description', content: 'The professional sports community within VITO Physio.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Discover,
});
function Discover() { const { user } = Route.useRouteContext(); return <AthletePortal user={user} view="discover" />; }
