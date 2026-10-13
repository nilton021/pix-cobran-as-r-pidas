import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const listSchema = z.object({ accountId: z.string().uuid() });

export const listApiAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: account, error: accountError } = await context.supabase
      .from("accounts")
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error("Conta não encontrada");
    }

    const { data: events, error } = await supabaseAdmin
      .from("api_audit_events")
      .select("id, request_id, route, method, status_code, duration_ms, event_type, created_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[api-audit] falha ao listar eventos", error.message);
      throw new Error("Não foi possível carregar o histórico da API");
    }

    return events ?? [];
  });
