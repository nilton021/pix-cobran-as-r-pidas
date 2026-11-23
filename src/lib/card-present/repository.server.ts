import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { cardSessionSchema, type CardSession, type CardEvent, type CardInput } from "./contracts";
import { hashCardInput, requireCardEnabled } from "./security.server";
import { mockCardAdapter } from "./adapter.server";
export class CardConflict extends Error {}
// O SQL está em proposta não aplicada. Não modificar tipos gerados para simular schema existente.
export async function cardRpc(name: string, args: Record<string, Json>): Promise<unknown> {
  requireCardEnabled();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc as unknown as (name: string, args: Record<string, Json>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  const { data, error } = await rpc(name, args);
  if (error?.code === "23505") throw new CardConflict("Card reference conflict");
  if (error) throw new Error("Card storage unavailable");
  return data;
}
export async function createCardSession(accountId: string, actorId: string, key: string, input: CardInput): Promise<{ session: CardSession; replay: boolean }> {
  const sessionId = crypto.randomUUID();
  const snapshot = await mockCardAdapter.createSession({ sessionId, amountCents: input.amountCents });
  const result = z.object({ session: cardSessionSchema, replay: z.boolean() }).parse(await cardRpc("card_nfc_create_session", {
    p_account_id: accountId, p_actor_id: actorId, p_key: key, p_hash: hashCardInput(input),
    p_integration_id: input.integrationId, p_amount: input.amountCents,
    p_reference: input.externalReference ?? null, p_device_id: input.deviceId ?? null,
    p_session_id: sessionId, p_provider_session_id: snapshot.providerSessionId,
  }));
  return result;
}
export async function readCardSession(accountId: string, id: string): Promise<CardSession | null> {
  const value = await cardRpc("card_nfc_read_session", { p_account_id: accountId, p_id: id });
  return value === null ? null : cardSessionSchema.parse(value);
}
export async function consumeCardLimit(accountId: string, actorId: string): Promise<boolean> {
  return z.boolean().parse(await cardRpc("card_nfc_consume_limit", { p_account_id: accountId, p_actor_id: actorId }));
}
export async function enqueueCardEvent(event: CardEvent, timestamp: number, hash: string): Promise<boolean> {
  return z.boolean().parse(await cardRpc("card_nfc_enqueue_event", {
    p_event_id: event.eventId, p_integration_id: event.integrationId,
    p_provider_session_id: event.providerSessionId, p_amount: event.amountCents,
    p_status: event.status, p_signed_at: new Date(timestamp * 1000).toISOString(), p_hash: hash,
  }));
}
export async function reconcileCardSessions(): Promise<{ processed: number }> {
  const lease = crypto.randomUUID();
  const ids = z.array(z.string().uuid()).parse(await cardRpc("card_nfc_claim_events", { p_lease: lease }));
  let processed = 0;
  for (const id of ids) {
    await cardRpc("card_nfc_finish_event", { p_id: id, p_lease: lease }); processed++;
  }
  await cardRpc("card_nfc_expire_sessions", {});
  return { processed };
}
