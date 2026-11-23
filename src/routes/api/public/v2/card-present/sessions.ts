import { createFileRoute } from "@tanstack/react-router";
// Alias externo: a parede de acesso do site não substitui API key no handler.
export const Route = createFileRoute("/api/public/v2/card-present/sessions")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cardApi } = await import("@/lib/card-present/handlers.server");
        return cardApi(request, process.env["CARD_NFC_ENABLED"]);
      },
    },
  },
});
