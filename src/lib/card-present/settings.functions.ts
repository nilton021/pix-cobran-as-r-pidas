import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isCardEnabled, sessionResponse } from "./contracts";

export const getCardAvailability = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async () => ({ enabled: isCardEnabled(process.env["CARD_NFC_ENABLED"]) }));

export const getCardSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { requireCardEnabled } = await import("./security.server"); requireCardEnabled();
    const { data: accounts, error } = await context.supabase.from("accounts").select("id, name");
    if (error) throw new Error("Não foi possível carregar contas");
    return { accounts: accounts ?? [] };
  });
export const prepareCardMock = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ accountId: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { requireCardEnabled } = await import("./security.server"); requireCardEnabled();
    const { data: account } = await context.supabase.from("accounts").select("id").eq("id", data.accountId).maybeSingle();
    if (!account) throw new Error("Conta não encontrada");
    const { cardRpc } = await import("./repository.server");
    const id = z.string().uuid().parse(await cardRpc("card_nfc_prepare_mock", { p_account_id: account.id, p_user_id: context.userId }));
    return { integrationId: id, simulation: true as const };
  });
export const createCardFromCharge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ chargeId: z.string().uuid(), key: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { requireCardEnabled } = await import("./security.server"); requireCardEnabled();
    const { data: charge } = await context.supabase.from("charges").select("id, account_id, amount_cents").eq("id", data.chargeId).maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada");
    const { data: integration } = await context.supabase.from("payment_integrations").select("id")
      .eq("account_id", charge.account_id).eq("provider", "MERCADOPAGO").eq("environment", "SANDBOX").eq("status", "INACTIVE").maybeSingle();
    if (!integration) throw new Error("Prepare o sandbox em Configurações antes de testar");
    const { consumeCardLimit, createCardSession } = await import("./repository.server");
    if (!await consumeCardLimit(charge.account_id, context.userId)) throw new Error("Limite de requisições excedido");
    const result = await createCardSession(charge.account_id, context.userId, data.key, {
      integrationId: integration.id, amountCents: charge.amount_cents,
      externalReference: `charge_${charge.id}`,
    });
    return sessionResponse(result.session);
  });
export const getCardDetail = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ chargeId: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { requireCardEnabled } = await import("./security.server"); requireCardEnabled();
    const { data: charge } = await context.supabase.from("charges").select("id, account_id").eq("id", data.chargeId).maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada");
    const { readCardSession } = await import("./repository.server");
    const session = await readCardSession(charge.account_id, charge.id);
    return session ? sessionResponse(session) : null;
  });
