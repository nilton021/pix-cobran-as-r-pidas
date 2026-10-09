import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TablesUpdate } from "@/integrations/supabase/types";

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
    const { data: account, error } = await context.supabase
      .from("accounts").select("*").eq("id", data.accountId).maybeSingle();
    if (error || !account) throw new Error("Conta não encontrada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: integrations, error: integrationErr } = await context.supabase
      .from("payment_integrations")
      .select("id, provider")
      .eq("account_id", account.id)
      .in("provider", ["PICPAY", "ASAAS", "INTER", "EFI"])
      .eq("status", "ACTIVE");

    if (integrationErr || !integrations || integrations.length !== 1) {
      throw new Error(
        integrations?.length
          ? "É necessário manter exatamente uma integração de pagamentos ativa para esta conta."
          : "Nenhuma integração de pagamentos ativa configurada para esta conta.",
      );
    }

    const integration = integrations[0]!;
    const paymentIntegrationId = integration.id;
    const provider = integration.provider;
    const picpay = provider === "PICPAY" ? await import("./picpay.server") : null;
    const asaas = provider === "ASAAS" ? await import("./asaas.server") : null;
    const inter = provider === "INTER" ? await import("./inter.server") : null;
    const efi = provider === "EFI" ? await import("./efi.server") : null;

    const { data: charge, error: insErr } = await supabaseAdmin.from("charges").insert({
      account_id: account.id,
      payment_integration_id: paymentIntegrationId,
      amount_cents: data.amountCents,
      description: data.description || null,
      status: "PENDING",
    }).select().single();
    if (insErr || !charge) throw new Error("Não foi possível criar a cobrança");

    try {
      const result = provider === "ASAAS"
        ? await asaas!.createPixCharge(paymentIntegrationId, {
            externalReference: charge.id, name: account.name, email: account.email,
            document: account.document, amountCents: data.amountCents,
            description: data.description, expirationSeconds: data.expirationSeconds,
          })
        : provider === "INTER"
          ? await inter!.createPixCharge(paymentIntegrationId, {
              externalReference: charge.id, amountCents: data.amountCents,
              description: data.description, expirationSeconds: data.expirationSeconds,
            })
          : provider === "EFI"
            ? await efi!.createPixCharge(paymentIntegrationId, {
                externalReference: charge.id, amountCents: data.amountCents,
                description: data.description, expirationSeconds: data.expirationSeconds,
              })
            : await picpay!.createPixCharge(paymentIntegrationId, {
              merchantChargeId: charge.id,
              customer: { name: account.name, email: account.email,
                documentType: account.document_type as "CPF" | "CNPJ", document: account.document },
              amountCents: data.amountCents, expirationSeconds: data.expirationSeconds,
            });

      const r = result as {
        pix?: { payload?: string; encodedImage?: string; expirationDate?: string };
        pixCopiaECola?: string;
        transactions?: { pix?: { payload?: string; encodedImage?: string; expirationDate?: string } }[];
        paymentId?: string;
        txid?: string;
        id?: string;
      };
      const pix: { payload?: string; encodedImage?: string; expirationDate?: string; qrCode?: string; qrCodeBase64?: string } | undefined =
        provider === "ASAAS"
          ? r.pix
          : provider === "INTER" || provider === "EFI"
            ? { payload: r.pixCopiaECola }
            : r.transactions?.[0]?.pix;
      const remoteId = provider === "ASAAS"
        ? r.paymentId
        : provider === "INTER" || provider === "EFI"
          ? r.txid
          : r.id;
      const update: TablesUpdate<"charges"> = provider === "ASAAS"
        ? {
            provider_charge_id: remoteId ?? null,
            picpay_charge_id: null,
            qr_code: pix?.payload ?? null,
            qr_code_base64: pix?.encodedImage ?? null,
            expires_at: pix?.expirationDate ?? new Date(Date.now() + data.expirationSeconds * 1000).toISOString(),
          }
        : provider === "INTER" || provider === "EFI"
          ? {
              provider_charge_id: remoteId ?? null,
              picpay_charge_id: null,
              qr_code: pix?.payload ?? null,
              qr_code_base64: null,
              expires_at: new Date(Date.now() + data.expirationSeconds * 1000).toISOString(),
            }
          : {
            provider_charge_id: remoteId ?? null,
            picpay_charge_id: remoteId ?? null,
            qr_code: pix?.qrCode ?? null,
            qr_code_base64: pix?.qrCodeBase64 ?? null,
            expires_at: new Date(Date.now() + data.expirationSeconds * 1000).toISOString(),
          };

      const { data: updated, error: upErr } = await supabaseAdmin
        .from("charges").update(update).eq("id", charge.id).select().single();
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
      .select("id, payment_integration_id, provider_charge_id, amount_cents, status, paid_at")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!owned?.payment_integration_id) throw new Error("Cobrança não encontrada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: integration } = await context.supabase
      .from("payment_integrations")
      .select("provider")
      .eq("id", owned.payment_integration_id)
      .maybeSingle();

    if (integration?.provider === "INTER") {
      const { getCharge, statusToLocal } = await import("./inter.server");
      if (!owned.provider_charge_id) throw new Error("Cobrança Inter sem txid");
      const remote = await getCharge(owned.payment_integration_id, owned.provider_charge_id) as { status?: string; valor?: { original?: string | number } };
      const status = statusToLocal(remote.status);
      if (status === "PAID") {
        const paidValue = remote.valor?.original;
        if (paidValue === undefined || paidValue === null || Math.round(Number(paidValue) * 100) !== owned.amount_cents) {
          throw new Error("Valor pago divergente ou ausente na confirmação do Banco Inter");
        }
      }
      const { data: updated, error } = await supabaseAdmin.from("charges").update({
        status, paid_at: status === "PAID" ? (owned.paid_at ?? new Date().toISOString()) : owned.paid_at, last_error: null,
      }).eq("id", data.chargeId).neq("status", "PAID").select().single();
      if (error) throw error;
      return updated;
    }

    if (integration?.provider === "EFI") {
      const { getCharge, statusToLocal } = await import("./efi.server");
      if (!owned.provider_charge_id) throw new Error("Cobrança Efí sem txid");
      const remote = await getCharge(owned.payment_integration_id, owned.provider_charge_id) as { status?: string; valor?: { original?: string | number } };
      const status = statusToLocal(remote.status);
      if (status === "PAID") {
        const paidValue = remote.valor?.original;
        if (paidValue === undefined || paidValue === null || Math.round(Number(paidValue) * 100) !== owned.amount_cents) {
          throw new Error("Valor pago divergente ou ausente na confirmação da Efí");
        }
      }
      const { data: updated, error } = await supabaseAdmin.from("charges").update({
        status,
        paid_at: status === "PAID" ? (owned.paid_at ?? new Date().toISOString()) : owned.paid_at,
        last_error: null,
      }).eq("id", data.chargeId).neq("status", "PAID").select().single();
      if (error) throw error;
      return updated;
    }

    if (integration?.provider === "ASAAS") {
      const { getPayment, statusToLocal } = await import("./asaas.server");
      if (!owned.provider_charge_id) throw new Error("Cobrança Asaas sem identificador remoto");
      const remote = await getPayment(owned.payment_integration_id, owned.provider_charge_id) as { status?: string; value?: number };
      const status = statusToLocal(remote.status);
      if (status === "PAID") {
        if (remote.value === undefined || remote.value === null || Math.round(remote.value * 100) !== owned.amount_cents) {
          throw new Error("Valor pago divergente ou ausente na confirmação do Asaas");
        }
      }
      const { data: updated, error } = await supabaseAdmin.from("charges").update({
        status,
        paid_at: status === "PAID" ? (owned.paid_at ?? new Date().toISOString()) : owned.paid_at,
        last_error: null,
      }).eq("id", data.chargeId).neq("status", "PAID").select().single();
      if (error) throw error;
      return updated;
    }

    const { getCharge, applyStatus } = await import("./picpay.server");
    try {
      const remote = await getCharge(owned.payment_integration_id, data.chargeId);
      return await applyStatus(data.chargeId, remote);
    } catch (e) {
      console.error("[sync-charge] falha", data.chargeId, (e as Error).message);
      throw new Error("Não foi possível consultar o provedor agora.");
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
