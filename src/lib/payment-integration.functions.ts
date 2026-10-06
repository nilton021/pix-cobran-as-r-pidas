import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  accountId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  provider: z.enum(["PICPAY", "ASAAS"]),
  displayName: z.string().trim().min(1).max(80),
  environment: z.enum(["SANDBOX", "PRODUCTION"]),
  credential1: z.string().max(4000).optional().default(""),
  credential2: z.string().max(4000).optional().default(""),
});

export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("accounts").select("id, name").order("created_at", { ascending: true }).limit(1);
    if (data.accountId) q = q.eq("id", data.accountId);
    const { data: accounts, error } = await q;
    const account = accounts?.[0];
    if (error || !account) throw new Error("Conta não encontrada");

    const { data: integrations, error: integrationError } = await context.supabase
      .from("payment_integrations")
      .select("id, account_id, provider, environment, display_name, status, created_at, updated_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: true });
    if (integrationError) throw new Error("Não foi possível carregar as integrações");
    return { account, integrations: integrations ?? [] };
  });

export const savePaymentIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: account, error } = await context.supabase.from("accounts").select("id").eq("id", data.accountId).maybeSingle();
    if (error || !account) throw new Error("Conta não encontrada");

    if (data.provider === "PICPAY") {
      const { data: id, error: rpcError } = await context.supabase.rpc("save_picpay_integration", {
        p_account_id: account.id,
        p_integration_id: data.integrationId ?? null,
        p_display_name: data.displayName,
        p_environment: data.environment,
        p_client_id: data.credential1 || null,
        p_client_secret: data.credential2 || null,
        p_webhook_secret: "",
      });
      if (rpcError || !id) throw new Error(rpcError?.message || "Não foi possível salvar o PicPay");
      return { integrationId: id };
    }

    const { data: id, error: rpcError } = await context.supabase.rpc("save_asaas_integration", {
      p_account_id: account.id,
      p_integration_id: data.integrationId ?? null,
      p_display_name: data.displayName,
      p_environment: data.environment,
      p_api_key: data.credential1 || null,
      p_webhook_token: data.credential2 || null,
    });
    if (rpcError || !id) throw new Error(rpcError?.message || "Não foi possível salvar o Asaas");
    return { integrationId: id };
  });
