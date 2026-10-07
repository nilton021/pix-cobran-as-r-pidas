import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as Json | null;
        const object = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
        const eventId = typeof object?.["id"] === "string" ? object["id"] : null;
        const event = typeof object?.["event"] === "string" ? object["event"] : null;
        const payment = object?.["payment"] && typeof object["payment"] === "object" && !Array.isArray(object["payment"]) ? object["payment"] : null;
        const remoteId = typeof payment?.["id"] === "string" ? payment["id"] : null;
        if (!eventId || !event || !remoteId) return new Response("Bad Request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: candidates } = await supabaseAdmin
          .from("charges")
          .select("id, payment_integration_id")
          .eq("provider_charge_id", remoteId)
          .limit(1);
        const charge = candidates?.[0];
        if (!charge?.payment_integration_id) return new Response("Unauthorized", { status: 401 });

        const { getWebhookSecret, getPayment, statusToLocal } = await import("@/lib/asaas.server");
        const { safeEqual } = await import("@/lib/picpay.server");
        let secret: string;
        try { secret = await getWebhookSecret(charge.payment_integration_id); } catch { return new Response("Unauthorized", { status: 401 }); }

        const supplied = request.headers.get("asaas-access-token") ?? "";
        if (!supplied || !safeEqual(supplied, secret)) return new Response("Unauthorized", { status: 401 });

        const hash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
        const { data: duplicate } = await supabaseAdmin.from("webhook_events").select("id").eq("event_id", eventId).maybeSingle();
        if (!duplicate) {
          await supabaseAdmin.from("webhook_events").insert({ event_id: eventId, merchant_charge_id: charge.id, status: event, payload_hash: hash });
        }

        try {
          const remote = await getPayment(charge.payment_integration_id, remoteId);
          const status = statusToLocal(remote.status);
          await supabaseAdmin.from("charges").update({
            status,
            paid_at: status === "PAID" ? new Date().toISOString() : null,
            last_error: null,
          }).eq("id", charge.id);
        } catch (error) {
          console.error("[asaas-webhook] falha ao sincronizar", charge.id, (error as Error).message);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
