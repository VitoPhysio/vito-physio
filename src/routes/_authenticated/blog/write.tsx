import { createFileRoute } from "@tanstack/react-router";
import { BlogEditor } from "@/components/vito/Blog";

export const Route = createFileRoute("/_authenticated/blog/write")({
  head: () => ({ meta: [{ title: "Write a story — VITO Journal" }] }),
  component: WriteBlogStoryPage,
});

function WriteBlogStoryPage() {
  const { user } = Route.useRouteContext();
  return <BlogEditor user={user} />;
}
