import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  accountId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  provider: z.enum(["PICPAY", "ASAAS", "INTER", "EFI"]),
  displayName: z.string().trim().min(1).max(80),
  environment: z.enum(["SANDBOX", "PRODUCTION"]),
  credential1: z.string().max(4000).optional().default(""),
  credential2: z.string().max(4000).optional().default(""),
  credential3: z.string().max(1000000).optional().default(""),
  credential4: z.string().max(4000).optional().default(""),
  credential5: z.string().max(4000).optional().default(""),
  credential6: z.string().max(4000).optional().default(""),
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
        p_webhook_secret: data.credential3 || null,
      });
      if (rpcError || !id) throw new Error(rpcError?.message || "Não foi possível salvar o PicPay");
      return { integrationId: id };
    }

    if (data.provider === "INTER") {
      const { data: id, error: rpcError } = await (context.supabase as any).rpc("save_inter_integration", {
        p_account_id: account.id,
        p_integration_id: data.integrationId ?? null,
        p_display_name: data.displayName,
        p_environment: data.environment,
        p_client_id: data.credential1 || null,
        p_client_secret: data.credential2 || null,
        p_cert_pem: data.credential3 || null,
        p_key_pem: data.credential4 || null,
        p_pix_key: data.credential5 || null,
        p_account_number: data.credential6 || null,
      });
      if (rpcError || !id) throw new Error(rpcError?.message || "Não foi possível salvar o Banco Inter");
      return { integrationId: id };
    }

    if (data.provider === "EFI") {
      const { data: result, error: rpcError } = await (context.supabase as any).rpc("save_efi_integration", {
        p_account_id: account.id,
        p_integration_id: data.integrationId ?? null,
        p_display_name: data.displayName,
        p_environment: data.environment,
        p_client_id: data.credential1 || null,
        p_client_secret: data.credential2 || null,
        p_certificate_base64: data.credential3 || null,
        p_certificate_password: data.credential4 || null,
        p_pix_key: data.credential5 || null,
      });
      const row = result?.[0];
      if (rpcError || !row?.integration_id) throw new Error(rpcError?.message || "Não foi possível salvar o Efí Bank");
      return { integrationId: row.integration_id, webhookHmac: row.webhook_hmac as string };
    }

    const { data: id, error: rpcError } = await (context.supabase as any).rpc("save_asaas_integration", {
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
