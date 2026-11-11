import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const cancelAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Leitura pelo cliente autenticado aplica RLS e limita a cobrança ao credor.
    const { data: charge, error } = await context.supabase
      .from("charges")
      .select("id, payment_integration_id, provider_charge_id, amount_cents, status, paid_at")
      .eq("id", data.chargeId)
      .maybeSingle();

    if (error || !charge) throw new Error("Cobrança não encontrada");
    if (charge.status === "PAID") return charge;
    if (charge.status !== "PENDING") {
      throw new Error("Somente cobranças pendentes podem ser canceladas");
    }
    if (!charge.payment_integration_id || !charge.provider_charge_id) {
      throw new Error("Cobrança Asaas sem identificador remoto");
    }

    const { data: integration, error: integrationError } = await context.supabase
      .from("payment_integrations")
      .select("id, provider")
      .eq("id", charge.payment_integration_id)
      .maybeSingle();

    if (integrationError || integration?.provider !== "ASAAS") {
      throw new Error("Esta ação está disponível somente para cobranças Asaas");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cancelPayment, getPayment } = await import("@/lib/asaas.server");
    const outcome = await cancelPayment(charge.payment_integration_id, charge.provider_charge_id);

    if (outcome === "PAID") {
      const remote = await getPayment(charge.payment_integration_id, charge.provider_charge_id);
      if (remote.value === undefined || remote.value === null ||
          Math.round(Number(remote.value) * 100) !== charge.amount_cents) {
        throw new Error("Valor pago divergente ou ausente na confirmação do Asaas");
      }
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("charges")
        .update({ status: "PAID", paid_at: charge.paid_at ?? new Date().toISOString(), last_error: null })
        .eq("id", charge.id)
        .eq("status", "PENDING")
        .select()
        .maybeSingle();
      if (updateError) throw updateError;
      if (updated) return updated;
      const { data: latest, error: latestError } = await supabaseAdmin
        .from("charges").select("*").eq("id", charge.id).maybeSingle();
      if (latestError || !latest) throw new Error("Não foi possível confirmar o estado local da cobrança");
      return latest;
    }

    // Só gravar CANCELED depois da confirmação remota; a condição protege
    // contra um webhook concorrente que já tenha marcado a cobrança como paga.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("charges")
      .update({ status: "CANCELED", qr_code: null, qr_code_base64: null, last_error: null })
      .eq("id", charge.id)
      .eq("status", "PENDING")
      .select()
      .maybeSingle();

    if (updateError) throw updateError;
    if (updated) return updated;

    const { data: latest, error: latestError } = await supabaseAdmin
      .from("charges").select("*").eq("id", charge.id).maybeSingle();
    if (latestError || !latest) throw new Error("Não foi possível confirmar o estado local da cobrança");
    if (latest.status === "PAID") return latest;
    if (latest.status === "CANCELED") return latest;
    throw new Error("A cobrança foi cancelada no Asaas, mas o estado local mudou durante a operação");
  });
