import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  accountId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  description: z.string().max(140).optional(),
  expirationSeconds: z.number().int().min(60).max(86400).default(900),
});

export const createCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
.handler(async ({ data, context }) => {
    // Confere propriedade via RLS do usuário
    const { data: account, error } = await context.supabase
      .from("accounts").select("*").eq("id", data.accountId).maybeSingle();
    if (error || !account) throw new Error("Conta não encontrada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPixCharge, PicPayError } = await import("./picpay.server");

    const { data: integrations, error: integrationErr } = await context.supabase
      .from("payment_integrations")
      .select("id")
      .eq("account_id", account.id)
      .eq("provider", "PICPAY")
      .eq("status", "ACTIVE");

    if (integrationErr || !integrations || integrations.length !== 1) {
      throw new Error(
        integrations?.length
          ? "É necessário manter exatamente uma integração PicPay ativa para esta conta."
          : "Nenhuma integração PicPay ativa configurada para esta conta.",
      );
    }
    const paymentIntegrationId = integrations[0].id;

    const { data: charge, error: insErr } = await supabaseAdmin.from("charges").insert({
      account_id: account.id,
      payment_integration_id: paymentIntegrationId,
      amount_cents: data.amountCents,
      description: data.description || null,
      status: "PENDING",
    }).select().single();
    if (insErr || !charge) throw new Error("Não foi possível criar a cobrança");

    try {
      const res = await createPixCharge(paymentIntegrationId, {
        merchantChargeId: charge.id,
        customer: {
          name: account.name,
          email: account.email,
          documentType: account.document_type as "CPF" | "CNPJ",
          document: account.document,
        },
        amountCents: data.amountCents,
        expirationSeconds: data.expirationSeconds,
      });
      const pix = res.transactions?.[0]?.pix;
      const { data: updated, error: upErr } = await supabaseAdmin.from("charges").update({
        picpay_charge_id: res.id ?? null,
        qr_code: pix?.qrCode ?? null,
        qr_code_base64: pix?.qrCodeBase64 ?? null,
        expires_at: new Date(Date.now() + data.expirationSeconds * 1000).toISOString(),
      }).eq("id", charge.id).select().single();
      if (upErr) throw upErr;
      return updated;
    } catch (e) {
      const msg = e instanceof PicPayError ? `${e.message}: ${e.body.slice(0, 300)}` : (e as Error).message;
      await supabaseAdmin.from("charges").update({ status: "ERROR", last_error: msg }).eq("id", charge.id);
      console.error("[create-charge] falha", charge.id, msg);
      throw new Error("Não foi possível gerar o Pix no PicPay. Tente novamente em instantes.");
    }
  });

export const syncCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("charges")
      .select("id, payment_integration_id")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!owned) throw new Error("Cobrança não encontrada");
    const { getCharge, applyStatus } = await import("./picpay.server");
    if (!owned.payment_integration_id) throw new Error("Integração de pagamento não vinculada");
    try {
      const remote = await getCharge(owned.payment_integration_id, data.chargeId);
      return await applyStatus(data.chargeId, remote);
    } catch (e) {
      console.error("[sync-charge] falha", data.chargeId, (e as Error).message);
      throw new Error("Não foi possível consultar o PicPay agora.");
    }
  });

export const getWebhookInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    configured: {
      PICPAY_API_BASE_URL: !!process.env["PICPAY_API_BASE_URL"],
      PICPAY_CLIENT_ID: false,
      PICPAY_CLIENT_SECRET: false,
      PICPAY_WEBHOOK_TOKEN: !!process.env["PICPAY_WEBHOOK_TOKEN"],
    },
  }));
