import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import type { TablesUpdate } from "@/integrations/supabase/types";

type InterWebhookPayload = {
  pix?: Array<{ txid?: unknown; endToEndId?: unknown }>;
};
type InterCharge = {
  status?: string;
  valor?: { original?: string | number };
};

export const Route = createFileRoute("/api/public/inter-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as InterWebhookPayload | null;
        const pix = Array.isArray(payload?.pix) ? payload.pix[0] : null;
        const txid = typeof pix?.txid === "string" ? pix.txid : null;
        const endToEndId = typeof pix?.endToEndId === "string" ? pix.endToEndId : null;
        if (!txid) return new Response("Bad Request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: charge } = await supabaseAdmin
          .from("charges")
          .select("id, payment_integration_id, amount_cents, status")
          .eq("provider_charge_id", txid)
          .limit(1)
          .maybeSingle();
        if (!charge?.payment_integration_id) return new Response("Not Found", { status: 404 });

        const { getCharge, statusToLocal } = await import("@/lib/inter.server");
        let remote: InterCharge;
        try {
          remote = await getCharge(charge.payment_integration_id, txid);
        } catch {
          return new Response("Service Unavailable", { status: 503 });
        }

        const status = statusToLocal(remote?.status);
        const paidValue = remote?.valor?.original ? Number(remote.valor.original) * 100 : null;
        if (status === "PAID" && paidValue !== null && Math.round(paidValue) !== charge.amount_cents) {
          return new Response("Payment amount mismatch", { status: 409 });
        }

        const eventId = endToEndId ? "INTER:" + endToEndId : "INTER:TXID:" + txid;
        const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
        const { data: duplicate } = await supabaseAdmin.from("webhook_events").select("id").eq("event_id", eventId).maybeSingle();
        if (!duplicate) {
          await supabaseAdmin.from("webhook_events").insert({
            event_id: eventId,
            merchant_charge_id: charge.id,
            status: status,
            payload_hash: payloadHash,
          });
        }

        const update: TablesUpdate<"charges"> = { status, last_error: null };
        if (status === "PAID") update.paid_at = new Date().toISOString();
        if (endToEndId) update.end_to_end_id = endToEndId;
        await supabaseAdmin.from("charges").update(update).eq("id", charge.id).neq("status", "PAID");

        return new Response("ok", { status: 200 });
      },
    },
  },
});
