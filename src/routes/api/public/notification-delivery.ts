import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notification-delivery")({
  server: { handlers: { POST: async ({ request }) => {
    // External scheduler/webhook only: do not accept ordinary user JWTs.
    const webhookSecret = process.env["NOTIFICATION_WEBHOOK_SECRET"];
    if (!webhookSecret || request.headers.get("Authorization") !== `Bearer ${webhookSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { processPushQueue } = await import("@/lib/push-delivery.server");
    const result = await processPushQueue();
    return Response.json(result, { status: result.error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } } },
});
