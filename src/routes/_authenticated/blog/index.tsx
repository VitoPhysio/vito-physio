import { createFileRoute } from "@tanstack/react-router";
import { BlogFeed } from "@/components/vito/Blog";

export const Route = createFileRoute("/_authenticated/blog/")({
  head: () => ({
    meta: [
      { title: "VITO Journal — Ideas for better sport and recovery" },
      {
        name: "description",
        content:
          "Practical insights, recovery stories and fresh ideas from the VITO Physio community.",
      },
    ],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { user } = Route.useRouteContext();
  return <BlogFeed user={user} />;
}
