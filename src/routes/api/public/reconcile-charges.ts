import { createFileRoute } from "@tanstack/react-router";

// Reconciliação periódica (pg_cron). Protegida pelo segredo em app_config enviado no header x-cron-secret.
export const Route = createFileRoute("/api/public/reconcile-charges")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { safeEqual, getCharge, applyStatus } = await import("@/lib/picpay.server");
        const { data: cfg } = await supabaseAdmin.from("app_config").select("value").eq("key", "cron_secret").single();
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!cfg?.value || !safeEqual(provided, cfg.value)) return new Response("Unauthorized", { status: 401 });

        const cutoff = new Date(Date.now() - 60_000).toISOString();
        const { data: rows } = await supabaseAdmin.from("charges")
          .select("id, payment_integration_id, expires_at").eq("status", "PENDING").lt("created_at", cutoff)
          .order("created_at", { ascending: true }).limit(15);

        let ok = 0, failed = 0;
        for (const r of rows ?? []) {
          try {
            if (!r.payment_integration_id) throw new Error("Cobrança sem integração de pagamento");
            const remote = await getCharge(r.payment_integration_id, r.id);
            const forceExpired = !!r.expires_at && new Date(r.expires_at).getTime() < Date.now() - 5 * 60_000;
            await applyStatus(r.id, remote, { forceExpired });
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
