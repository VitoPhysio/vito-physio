import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/vito/AppHeader";
import { SignedInBottomNavigation } from "@/components/vito/SignedInHome";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isMessages = pathname === "/messages";
  const isWorkspace = pathname === "/dashboard";

  return (
    <>
      {!isMessages && <AppHeader user={user} />}
      <div
        className={isMessages || isWorkspace ? "" : "pb-[calc(5rem+env(safe-area-inset-bottom))]"}
      >
        <Outlet />
      </div>
      {!isWorkspace && <SignedInBottomNavigation userId={user.id} />}
    </>
  );
}
