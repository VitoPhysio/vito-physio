import { createFileRoute } from "@tanstack/react-router";
import { BlogArticlePage } from "@/components/vito/Blog";

export const Route = createFileRoute("/_authenticated/blog/$slug")({
  head: () => ({
    meta: [
      { title: "VITO Journal — Article" },
      {
        name: "description",
        content: "Read practical ideas and stories from the VITO Physio community.",
      },
    ],
  }),
  component: BlogStoryPage,
});

function BlogStoryPage() {
  const { user } = Route.useRouteContext();
  const { slug } = Route.useParams();
  return <BlogArticlePage user={user} slug={slug} />;
}
