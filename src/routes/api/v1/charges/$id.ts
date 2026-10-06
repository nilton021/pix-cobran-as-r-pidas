import { createFileRoute } from "@tanstack/react-router";
import { createApiAuditContext, recordApiAudit } from "@/lib/api-audit.server";

export const Route = createFileRoute("/api/v1/charges/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const { authenticateApiKey } = await import("@/lib/api-key-auth.server");
          const auth = await authenticateApiKey(request);
          audit.accountId = auth.accountId;
          audit.apiKeyId = auth.apiKeyId;
          const { consumeApiRateLimit, rateLimitResponse } = await import("@/lib/api-rate-limit.server");
          const rateLimit = await consumeApiRateLimit(auth.apiKeyId, "read_charge");
          const limited = rateLimitResponse(rateLimit);
          if (limited) {
            await recordApiAudit(audit, { route: "/api/v1/charges/:id", method: "GET", statusCode: 429, eventType: "rate_limited" });
            return limited;
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: charge, error } = await supabaseAdmin
            .from("charges")
            .select("id, amount_cents, description, status, picpay_charge_id, qr_code, qr_code_base64, end_to_end_id, payer, expires_at, paid_at, created_at, updated_at")
            .eq("id", params.id)
            .eq("account_id", auth.accountId)
            .maybeSingle();

          if (error) throw error;
          if (!charge) return Response.json({ error: "Cobrança não encontrada" }, { status: 404 });
          return Response.json(charge);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unauthorized";
          if (message === "Rate limit indisponível") return Response.json({ error: "Serviço temporariamente indisponível" }, { status: 503 });
          if (message.startsWith("Unauthorized:")) return Response.json({ error: "Não autorizado" }, { status: 401 });
          return Response.json({ error: "Não foi possível consultar a cobrança" }, { status: 500 });
        }
      },
    },
  },
});
