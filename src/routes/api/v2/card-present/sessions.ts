import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/v2/card-present/sessions")({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const { cardApi } = await import("@/lib/card-present/handlers.server");
    return cardApi(request, process.env["CARD_NFC_ENABLED"]);
  } } },
});
