import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/efi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hmac = new URL(request.url).searchParams.get("hmac") ?? "";
        if (!hmac) return new Response("Unauthorized", { status: 401 });

        let payload: Json;
        try { payload = (await request.json()) as Json; } catch { return new Response("Bad Request", { status: 400 }); }

        const payloadObject = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
        const pixItems = Array.isArray(payloadObject?.["pix"]) ? payloadObject["pix"] : [];
        if (!pixItems.length) return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { safeEqual, getCharge, statusToLocal, getWebhookHmac } = await import("@/lib/efi.server");

        let processed = 0;
        for (const item of pixItems) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const pix = item as Record<string, Json | undefined>;
          const txid = typeof pix["txid"] === "string" ? pix["txid"] : "";
          const e2e = typeof pix["endToEndId"] === "string" ? pix["endToEndId"] : "";
          const value = typeof pix["valor"] === "string" || typeof pix["valor"] === "number" ? Number(pix["valor"]) : NaN;
          if (!txid || !/^[A-Za-z0-9]{26,35}$/.test(txid) || !e2e || !Number.isFinite(value)) continue;

          const { data: rows } = await supabaseAdmin.from("charges")
            .select("id, payment_integration_id, provider_charge_id, amount_cents, status, paid_at, payment_integrations!inner(provider)")
            .eq("provider_charge_id", txid)
            .eq("payment_integrations.provider", "EFI")
            .limit(2);

          const charge = rows?.length === 1 ? rows[0] : null;
          if (!charge?.payment_integration_id || charge.provider_charge_id !== txid) continue;

          let expectedHmac: string;
          try { expectedHmac = await getWebhookHmac(charge.payment_integration_id); } catch { continue; }
          if (!safeEqual(hmac, expectedHmac)) continue;

          const payloadHash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
          await supabaseAdmin.from("webhook_events").insert({
            event_id: e2e,
            status: "PIX_RECEBIDO",
            merchant_charge_id: charge.id,
            payload_hash: payloadHash,
          });

          try {
            const remote = await getCharge(charge.payment_integration_id, txid) as {
              txid?: string;
              status?: string;
              valor?: { original?: string | number };
            };
            const status = statusToLocal(remote.status);
            if (status !== "PAID" || remote.txid !== txid) continue;
            const remoteValue = remote.valor?.original;
            if (remoteValue === undefined || remoteValue === null || Math.round(Number(remoteValue) * 100) !== charge.amount_cents) continue;

            const { error } = await supabaseAdmin.from("charges").update({
              status: "PAID",
              paid_at: charge.paid_at ?? new Date().toISOString(),
              end_to_end_id: e2e,
              last_error: null,
            }).eq("id", charge.id).eq("status", "PENDING");
            if (error) throw error;
            processed++;
          } catch (e) {
            console.error("[efi-webhook] falha ao confirmar", charge.id, (e as Error).message);
          }
        }

        return Response.json({ ok: true, processed });
      },
    },
  },
});
