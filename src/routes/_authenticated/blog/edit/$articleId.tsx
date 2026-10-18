import { createFileRoute } from "@tanstack/react-router";
import { BlogEditor } from "@/components/vito/Blog";

export const Route = createFileRoute("/_authenticated/blog/edit/$articleId")({
  head: () => ({ meta: [{ title: "Edit story — VITO Journal" }] }),
  component: EditBlogStoryPage,
});

function EditBlogStoryPage() {
  const { user } = Route.useRouteContext();
  const { articleId } = Route.useParams();
  return <BlogEditor user={user} articleId={articleId} />;
}
