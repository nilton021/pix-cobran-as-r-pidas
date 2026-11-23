import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/card-present-webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cardWebhook } = await import("@/lib/card-present/handlers.server");
        return cardWebhook(request);
      },
    },
  },
});
