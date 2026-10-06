import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const settingsSchema = z.object({
  accountId: z.string().uuid().optional(),
});

const saveSchema = z.object({
  accountId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(80),
  environment: z.enum(["SANDBOX", "PRODUCTION"]),
  // Secrets are write-only from the UI. Empty values on edit mean "keep existing".
  clientId: z.string().trim().max(500).optional().default(""),
  clientSecret: z.string().max(2000).optional().default(""),
  webhookSecret: z.string().max(2000).optional().default(""),
});

export const getPicPaySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    let accountQuery = context.supabase
      .from("accounts")
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(1);

    if (data.accountId) accountQuery = accountQuery.eq("id", data.accountId);

    const { data: accounts, error: accountError } = await accountQuery;
    const account = accounts?.[0];

    if (accountError || !account) throw new Error("Conta não encontrada");

    const { data: integrations, error } = await context.supabase
      .from("payment_integrations")
      .select("id, account_id, provider, environment, display_name, status, created_at, updated_at")
      .eq("account_id", account.id)
      .eq("provider", "PICPAY")
      .order("created_at", { ascending: true });

    if (error) throw new Error("Não foi possível carregar as integrações PicPay");

    return {
      account,
      integrations: integrations ?? [],
      api: {
        baseUrlConfigured: Boolean(process.env["PICPAY_API_BASE_URL"]),
        apiPathConfigured: Boolean(process.env["PICPAY_API_PATH"]),
      },
    };
  });

export const savePicPayIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!process.env["PICPAY_API_BASE_URL"] || !process.env["PICPAY_API_PATH"]) {
      throw new Error("A API PicPay ainda não está configurada no ambiente do servidor");
    }

    const { data: account, error: accountError } = await context.supabase
      .from("accounts")
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();

    if (accountError || !account) throw new Error("Conta não encontrada");

    const { data: integrationId, error } = await context.supabase.rpc("save_picpay_integration", {
      p_account_id: account.id,
      p_integration_id: data.integrationId ?? null,
      p_display_name: data.displayName,
      p_environment: data.environment,
      p_client_id: data.clientId || null,
      p_client_secret: data.clientSecret || null,
      p_webhook_secret: data.webhookSecret || null,
    });

    if (error || !integrationId) {
      console.error("[picpay-settings] falha ao salvar integração", error?.message ?? "sem id");
      throw new Error(error?.message || "Não foi possível salvar a integração PicPay");
    }

    return { integrationId };
  });
