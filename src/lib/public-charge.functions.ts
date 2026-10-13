import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public checkout: return only payment details needed by the payer.
// The UUID acts as the unguessable public reference; never return account credentials or private customer data.
export const getPublicCharge = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: charge, error } = await supabaseAdmin
      .from("charges")
      .select("id, amount_cents, description, status, qr_code, qr_code_base64, expires_at, created_at, paid_at, accounts(name)")
      .eq("id", data.id)
      .maybeSingle();

    if (error) {
      console.error("[public-charge] failed to load charge", error.message);
      throw new Error("Não foi possível carregar esta cobrança.");
    }
    if (!charge) return null;

    const account = charge.accounts as { name: string } | null;
    return {
      id: charge.id,
      amountCents: charge.amount_cents,
      description: charge.description,
      status: charge.status,
      pixCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      createdAt: charge.created_at,
      paidAt: charge.paid_at,
      merchantName: account?.name ?? "Cobrança Pix",
    };
  });
