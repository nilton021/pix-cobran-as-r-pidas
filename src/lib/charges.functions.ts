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
    const picpay = provider === "PICPAY" ? await import("./picpay.server") : null;
    const asaas = provider === "ASAAS" ? await import("./asaas.server") : null;

    const { data: integrations, error: integrationErr } = await context.supabase
      .from("payment_integrations")
      .select("id, provider")
      .eq("account_id", account.id)
      .in("provider", ["PICPAY", "ASAAS"])
      .eq("status", "ACTIVE");

    if (integrationErr || !integrations || integrations.length !== 1) {
      throw new Error(
        integrations?.length
          ? "É necessário manter exatamente uma integração de pagamentos ativa para esta conta."
          : "Nenhuma integração de pagamentos ativa configurada para esta conta.",
      );
    }
    const paymentIntegrationId = integrations[0].id;
    const provider = integrations[0].provider;

    const { data: charge, error: insErr } = await supabaseAdmin.from("charges").insert({
      account_id: account.id,
      payment_integration_id: paymentIntegrationId,
      amount_cents: data.amountCents,
      description: data.description || null,
      status: "PENDING",
    }).select().single();
    if (insErr || !charge) throw new Error("Não foi possível criar a cobrança");

    try {
      const res = provider === "ASAAS"
        ? await asaas!.createPixCharge(paymentIntegrationId, {
        merchantChargeId: charge.id,
        customer: {
          name: account.name,
          email: account.email,
          documentType: account.document_type as "CPF" | "CNPJ",
          document: account.document,
        },
        amountCents: data.amountCents,
        expirationSeconds: data.expirationSeconds,
      })
        : await picpay!.createPixCharge(paymentIntegrationId, {
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
      const pix = provider === "ASAAS" ? res.pix : res.transactions?.[0]?.pix;
      const remoteId = provider === "ASAAS" ? res.paymentId : res.id;
      const { data: updated, error: upErr } = await supabaseAdmin.from("charges").update({
        provider_charge_id: remoteId ?? null,
        picpay_charge_id: provider === "PICPAY" ? remoteId ?? null : null,
        qr_code: provider === "ASAAS" ? pix?.payload ?? null : pix?.qrCode ?? null,
        qr_code_base64: provider === "ASAAS" ? pix?.encodedImage ?? null : pix?.qrCodeBase64 ?? null,
        expires_at: provider === "ASAAS" && pix?.expirationDate ? pix.expirationDate : new Date(Date.now() + data.expirationSeconds * 1000).toISOString(),
      }).eq("id", charge.id).select().single();
      if (upErr) throw upErr;
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("charges").update({ status: "ERROR", last_error: msg }).eq("id", charge.id);
      console.error("[create-charge] falha", charge.id, msg);
      throw new Error("Não foi possível gerar a cobrança. Tente novamente em instantes.");
    }
  });

export const syncCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("charges")
      .select("id, payment_integration_id, provider_charge_id")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!owned) throw new Error("Cobrança não encontrada");
    const { data: integration } = await context.supabase.from("payment_integrations").select("provider").eq("id", owned.payment_integration_id).maybeSingle();
    if (integration?.provider === "ASAAS") {
      const { getPayment, statusToLocal } = await import("./asaas.server");
      const remoteId = (owned as { provider_charge_id?: string | null }).provider_charge_id;
      if (!remoteId) throw new Error("Cobrança Asaas sem identificador remoto");
      const remote = await getPayment(owned.payment_integration_id, remoteId);
      const status = statusToLocal(remote.status);
      const { data: updated } = await supabaseAdmin.from("charges").update({ status, paid_at: status === "PAID" ? new Date().toISOString() : null }).eq("id", data.chargeId).select().single();
      return updated;
    }
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
      PICPAY_API_PATH: !!process.env["PICPAY_API_PATH"],
    },
  }));
