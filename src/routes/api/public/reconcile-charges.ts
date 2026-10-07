import { createFileRoute } from "@tanstack/react-router";

function providerOf(row: { payment_integrations?: { provider?: string } | { provider?: string }[] | null }) {
  const value = row.payment_integrations;
  return Array.isArray(value) ? value[0]?.provider : value?.provider;
}

// Reconciliação periódica (pg_cron). Protegida pelo segredo em app_config enviado no header x-cron-secret.
export const Route = createFileRoute("/api/public/reconcile-charges")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { safeEqual, getCharge: getPicPayCharge, applyStatus: applyPicPayStatus } = await import("@/lib/picpay.server");
        const { data: cfg } = await supabaseAdmin.from("app_config").select("value").eq("key", "cron_secret").single();
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!cfg?.value || !safeEqual(provided, cfg.value)) return new Response("Unauthorized", { status: 401 });

        const cutoff = new Date(Date.now() - 60_000).toISOString();
        const { data: rows } = await supabaseAdmin.from("charges")
          .select("id, payment_integration_id, provider_charge_id, amount_cents, paid_at, expires_at, payment_integrations!inner(provider)")
          .eq("status", "PENDING")
          .not("payment_integration_id", "is", null)
          .in("payment_integrations.provider", ["PICPAY", "EFI"])
          .lt("created_at", cutoff)
          .order("updated_at", { ascending: true })
          .limit(15);

        let ok = 0, failed = 0;
        for (const r of rows ?? []) {
          try {
            if (!r.payment_integration_id) throw new Error("Cobrança sem integração de pagamento");
            const provider = providerOf(r);
            if (provider === "EFI") {
              if (!r.provider_charge_id) throw new Error("Cobrança Efí sem txid");
              const { getCharge, statusToLocal } = await import("@/lib/efi.server");
              const remote = await getCharge(r.payment_integration_id, r.provider_charge_id) as {
                txid?: string;
                status?: string;
                valor?: { original?: string | number };
              };
              const status = statusToLocal(remote.status);
              if (status === "PAID") {
                const paidValue = remote.valor?.original;
                if (remote.txid && remote.txid !== r.provider_charge_id) {
                  throw new Error("Txid divergente na confirmação da Efí");
                }
                if (paidValue === undefined || paidValue === null || Math.round(Number(paidValue) * 100) !== r.amount_cents) {
                  throw new Error("Valor pago divergente ou ausente na confirmação da Efí");
                }
              }
              const { error } = await supabaseAdmin.from("charges").update({
                status,
                paid_at: status === "PAID" ? (r.paid_at ?? new Date().toISOString()) : r.paid_at,
                last_error: null,
              }).eq("id", r.id).eq("status", "PENDING");
              if (error) throw error;
            } else if (provider === "PICPAY") {
              const remote = await getPicPayCharge(r.payment_integration_id, r.id);
              const forceExpired = !!r.expires_at && new Date(r.expires_at).getTime() < Date.now() - 5 * 60_000;
              await applyPicPayStatus(r.id, remote, { forceExpired });
            }
            ok++;
          } catch (e) {
            failed++;
            console.error("[reconcile] falha", r.id, (e as Error).message);
          }
        }
        return Response.json({ processed: rows?.length ?? 0, ok, failed });
      },
    },
  },
});
