import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/reconcile-card-present")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cardReconcile } = await import("@/lib/card-present/handlers.server");
        return cardReconcile(request);
      },
    },
  },
});
