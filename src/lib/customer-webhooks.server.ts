import { createHash, createHmac, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EVENT = "charge.status_changed";

type CustomerWebhookEvent = {
  id: string;
  type: typeof EVENT;
  createdAt: string;
  data: {
    chargeId: string;
    accountId: string;
    status: string;
    amountCents: number;
    paidAt: string | null;
    updatedAt: string;
  };
};

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("ID inválido");
  }
}

export async function createCustomerWebhook(
  accountId: string,
  url: string,
  events: string[] = [EVENT],
): Promise<{ id: string; url: string; events: string[]; secret: string }> {
  assertUuid(accountId);
  if (!/^https:\/\//i.test(url)) throw new Error("Webhook do cliente deve usar HTTPS");
  if (!events.length || events.some((event) => event !== EVENT)) {
    throw new Error("Evento de webhook inválido");
  }

  const secret = randomBytes(32).toString("base64url");
  const secretName = `pix_customer_${randomBytes(16).toString("hex")}_webhook_secret`;

  const { data: endpoint, error } = await supabaseAdmin
    .from("customer_webhook_endpoints")
    .insert({ account_id: accountId, url, secret_name: secretName, events })
    .select("id, url, events")
    .single();

  if (error || !endpoint) throw new Error("Não foi possível criar o webhook do cliente");

  const { error: secretError } = await supabaseAdmin.rpc("set_customer_webhook_secret", {
    p_endpoint_id: endpoint.id,
    p_secret: secret,
  });

  if (secretError) {
    await supabaseAdmin.from("customer_webhook_endpoints").delete().eq("id", endpoint.id);
    throw new Error("Não foi possível proteger o segredo do webhook");
  }

  return { id: endpoint.id, url: endpoint.url, events: endpoint.events as string[], secret };
}

export async function deliverCustomerWebhook(charge: {
  id: string;
  account_id: string;
  status: string;
  amount_cents: number;
  paid_at: string | null;
  updated_at: string;
}): Promise<void> {
  const { data: endpoints, error } = await supabaseAdmin
    .from("customer_webhook_endpoints")
    .select("id, url, events")
    .eq("account_id", charge.account_id)
    .eq("active", true);

  if (error || !endpoints?.length) return;

  for (const endpoint of endpoints) {
    const events = Array.isArray(endpoint.events) ? endpoint.events : [];
    if (!events.includes(EVENT)) continue;

    try {
      const { data: secret, error: secretError } = await supabaseAdmin.rpc(
        "get_customer_webhook_secret",
        { p_endpoint_id: endpoint.id },
      );
      if (secretError || typeof secret !== "string") throw new Error("Segredo não configurado");

      const body: CustomerWebhookEvent = {
        id: randomBytes(16).toString("hex"),
        type: EVENT,
        createdAt: new Date().toISOString(),
        data: {
          chargeId: charge.id,
          accountId: charge.account_id,
          status: charge.status,
          amountCents: charge.amount_cents,
          paidAt: charge.paid_at,
          updatedAt: charge.updated_at,
        },
      };
      const raw = JSON.stringify(body);
      const signature = createHmac("sha256", secret).update(raw).digest("hex");

      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pix-Webhook-Signature": `sha256=${signature}`,
          "X-Pix-Webhook-Event": EVENT,
        },
        body: raw,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.error("[customer-webhook] entrega rejeitada", endpoint.id, response.status);
      }
    } catch (error) {
      console.error("[customer-webhook] falha na entrega", endpoint.id, (error as Error).message);
    }
  }
}

export function hashWebhookSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
