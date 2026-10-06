import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

// Chamado pelo PicPay. O payload é só um gatilho: o status é sempre confirmado na API.
export const Route = createFileRoute("/api/public/picpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { safeEqual, getCharge, applyStatus } = await import("@/lib/picpay.server");
        const expected = process.env["PICPAY_WEBHOOK_TOKEN"];
        const raw = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!expected || !raw || !safeEqual(raw, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: Json;
        try {
          payload = (await request.json()) as Json;
        } catch {
          return new Response("Bad Request", { status: 400 });
        }
        const payloadObject = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
        const data = payloadObject?.data && typeof payloadObject.data === "object" && !Array.isArray(payloadObject.data)
          ? payloadObject.data
          : null;
        const merchantChargeId = typeof data?.merchantChargeId === "string" ? data.merchantChargeId : undefined;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("webhook_events").insert({
          event_id: payload?.id ?? null,
          status: payload?.data?.status ?? null,
          merchant_charge_id: merchantChargeId ?? null,
          payload,
        });

        if (merchantChargeId && /^[0-9a-f-]{36}$/i.test(merchantChargeId)) {
          try {
            const remote = await getCharge(merchantChargeId);
            await applyStatus(merchantChargeId, remote);
          } catch (e) {
            console.error("[picpay-webhook] falha ao confirmar", merchantChargeId, (e as Error).message);
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
