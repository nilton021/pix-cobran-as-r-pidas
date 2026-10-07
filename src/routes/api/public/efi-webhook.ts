import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import type { TablesUpdate } from "@/integrations/supabase/types";

type EfiWebhookPayload = {
  pix?: Array<{ txid?: unknown; endToEndId?: unknown }>;
};
type EfiCharge = {
  status?: string;
  valor?: { original?: string | number };
};

export const Route = createFileRoute("/api/public/efi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const suppliedHmac = url.searchParams.get("hmac") ?? "";
        const payload = (await request.json().catch(() => null)) as EfiWebhookPayload | null;
        const pix = Array.isArray(payload?.pix) ? payload.pix[0] : null;
        const txid = typeof pix?.txid === "string" ? pix.txid : null;

        if (!suppliedHmac || !/^[a-f0-9]{64}$/i.test(suppliedHmac)) {
          return new Response("Unauthorized", { status: 401 });
        }

        if (!txid) {
          return new Response("ok", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: charge } = await supabaseAdmin
          .from("charges")
          .select("id, payment_integration_id, amount_cents, status")
          .eq("provider_charge_id", txid)
          .limit(1)
          .maybeSingle();

        if (!charge?.payment_integration_id) return new Response("Not Found", { status: 404 });

        const { getCharge, getWebhookHmac, statusToLocal } = await import("@/lib/efi.server");
        const { safeEqual } = await import("@/lib/picpay.server");

        let expectedHmac: string;
        try {
          expectedHmac = await getWebhookHmac(charge.payment_integration_id);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        if (!safeEqual(suppliedHmac, expectedHmac)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let remote: EfiCharge;
        try {
          remote = await getCharge(charge.payment_integration_id, txid);
        } catch {
          return new Response("Service Unavailable", { status: 503 });
        }

        const status = statusToLocal(remote?.status);
        const paidValue = remote?.valor?.original ? Number(remote.valor.original) * 100 : null;
        if (status === "PAID" && (paidValue === null || !Number.isFinite(paidValue) || Math.round(paidValue) !== charge.amount_cents)) {
          return new Response("Payment amount mismatch", { status: 409 });
        }

        const endToEndId = typeof pix?.endToEndId === "string" ? pix.endToEndId : null;
        const eventId = endToEndId ? "EFI:" + endToEndId : "EFI:TXID:" + txid;
        const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
        const { data: duplicate } = await supabaseAdmin
          .from("webhook_events")
          .select("id")
          .eq("event_id", eventId)
          .maybeSingle();

        if (!duplicate) {
          await supabaseAdmin.from("webhook_events").insert({
            event_id: eventId,
            merchant_charge_id: charge.id,
            status,
            payload_hash: payloadHash,
          });
        }

        const update: TablesUpdate<"charges"> = { status, last_error: null };
        if (status === "PAID") update.paid_at = new Date().toISOString();
        if (endToEndId) update.end_to_end_id = endToEndId;

        await supabaseAdmin
          .from("charges")
          .update(update)
          .eq("id", charge.id)
          .neq("status", "PAID");

        return new Response("ok", { status: 200 });
      },
    },
  },
});
