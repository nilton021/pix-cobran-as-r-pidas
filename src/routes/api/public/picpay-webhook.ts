import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

// Chamado pelo PicPay. O segredo é resolvido pela integração vinculada à cobrança.
export const Route = createFileRoute("/api/public/picpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { safeEqual, getCharge, applyStatus, getPicPayWebhookSecret } = await import("@/lib/picpay.server");
        let payload: Json;
        try { payload = (await request.json()) as Json; } catch { return new Response("Bad Request", { status: 400 }); }
        const payloadObject = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
        const data = payloadObject?.["data"] && typeof payloadObject["data"] === "object" && !Array.isArray(payloadObject["data"]) ? payloadObject["data"] : null;
        const merchantChargeId = typeof data?.["merchantChargeId"] === "string" ? data["merchantChargeId"] : undefined;
        if (!merchantChargeId || !/^[0-9a-f-]{36}$/.test(merchantChargeId)) return new Response("Bad Request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: charge } = await supabaseAdmin.from("charges").select("id, payment_integration_id").eq("id", merchantChargeId).maybeSingle();
        if (!charge?.payment_integration_id) return new Response("Unauthorized", { status: 401 });
        let expected: string;
        try { expected = await getPicPayWebhookSecret(charge.payment_integration_id); } catch { return new Response("Unauthorized", { status: 401 }); }
        const raw = (request.headers.get("authorization") ?? "").replace(/^Bearer\\s+/i, "").trim();
        if (!raw || !safeEqual(raw, expected)) return new Response("Unauthorized", { status: 401 });
        const payloadHash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
        await supabaseAdmin.from("webhook_events").insert({
          event_id: typeof payloadObject?.["id"] === "string" ? payloadObject["id"] : null,
          status: typeof data?.["status"] === "string" ? data["status"] : null,
          merchant_charge_id: merchantChargeId,
          payload_hash: payloadHash,
        });
        try {
          const remote = await getCharge(charge.payment_integration_id, merchantChargeId);
          await applyStatus(merchantChargeId, remote);
        } catch (e) {
          console.error("[picpay-webhook] falha ao confirmar", merchantChargeId, (e as Error).message);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
