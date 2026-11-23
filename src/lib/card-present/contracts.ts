import { z } from "zod";

export const cardStatuses = [
  "CREATED",
  "AWAITING_CARD",
  "APPROVED",
  "DECLINED",
  "CANCELED",
  "EXPIRED",
  "REFUNDED",
] as const;
export type CardStatus = (typeof cardStatuses)[number];
// O contrato não admite texto livre nem dados de cartão: apenas referências opacas.
export const opaqueReference = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/)
  .refine((value) => !/\d{12,19}/.test(value));
export const cardInput = z
  .object({
    integrationId: z.string().uuid(),
    amountCents: z.number().int().min(1).max(2147483647),
    externalReference: opaqueReference.optional(),
    deviceId: opaqueReference.optional(),
  })
  .strict();
export type CardInput = z.infer<typeof cardInput>;
export const cardSessionSchema = z
  .object({
    id: z.string().uuid(),
    charge_id: z.string().uuid(),
    account_id: z.string().uuid(),
    payment_integration_id: z.string().uuid(),
    provider: z.literal("MOCK"),
    provider_session_id: z.string().regex(/^mock_[0-9a-f-]{36}$/),
    amount_cents: z.number().int().positive(),
    status: z.enum(cardStatuses),
    expires_at: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();
export type CardSession = z.infer<typeof cardSessionSchema>;
export const cardEventSchema = z
  .object({
    eventId: opaqueReference,
    integrationId: z.string().uuid(),
    providerSessionId: z.string().regex(/^mock_[0-9a-f-]{36}$/),
    amountCents: z.number().int().positive().max(2147483647),
    status: z.enum(cardStatuses),
  })
  .strict();
export type CardEvent = z.infer<typeof cardEventSchema>;
export function isCardEnabled(value: string | undefined): boolean {
  return value === "true";
}
export function methodOf(charge: { payment_method?: string }): "PIX" | "CARD_NFC" {
  return charge.payment_method === "CARD_NFC" ? "CARD_NFC" : "PIX";
}
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  if (from === to) return true;
  if (from === "APPROVED") return to === "REFUNDED";
  if (["DECLINED", "CANCELED", "EXPIRED", "REFUNDED"].includes(from)) return false;
  return from !== "AWAITING_CARD" || to !== "CREATED";
}
export function sessionResponse(s: CardSession) {
  return {
    id: s.id,
    charge_id: s.charge_id,
    provider_session_id: s.provider_session_id,
    amount_cents: s.amount_cents,
    status: s.status,
    expires_at: s.expires_at,
    payment_method: "CARD_NFC" as const,
    provider: "MOCK" as const,
    simulation: true as const,
  };
}
