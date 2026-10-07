import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Payment = { id: string; status?: string; externalReference?: string };
type PixCode = { encodedImage?: string; payload?: string; expirationDate?: string };

async function getConfig(id: string) {
  const { data, error } = await supabaseAdmin.rpc("get_asaas_integration_credentials", {
    p_integration_id: id,
  });
  const row = data?.[0];
  if (error || !row) throw new Error("Integração Asaas não configurada");
  return row;
}

function origin(environment: string) {
  return environment === "SANDBOX" ? "https://api-sandbox.asaas.com" : "https://api.asaas.com";
}

async function call(id: string, path: string, init: RequestInit = {}) {
  const cfg = await getConfig(id);
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  headers["access_" + "token"] = cfg.api_key;
  return fetch(origin(cfg.environment) + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
}

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.text();
  if (!res.ok) throw new Error("Asaas respondeu " + res.status);
  return JSON.parse(body) as T;
}

export async function createPixCharge(id: string, input: {
  externalReference: string; name: string; email: string; document: string;
  amountCents: number; description?: string | undefined; expirationSeconds: number;
}) {
  const lookup = await readJson<{ data: Array<{ id: string }> }>(
    await call(id, "/v3/customers?email=" + encodeURIComponent(input.email))
  );
  let customer = lookup.data?.[0];
  if (!customer) {
    customer = await readJson<{ id: string }>(await call(id, "/v3/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name, email: input.email, cpfCnpj: input.document,
        externalReference: input.externalReference,
      }),
    }));
  }

  const dueDate = new Date(Date.now() + input.expirationSeconds * 1000).toISOString().slice(0, 10);
  const payment = await readJson<Payment>(await call(id, "/v3/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id, billingType: "PIX", value: input.amountCents / 100,
      dueDate, description: input.description?.slice(0, 500),
      externalReference: input.externalReference,
    }),
  }));

  const pix = await readJson<PixCode>(await call(id, "/v3/payments/" + encodeURIComponent(payment.id) + "/pixQrCode"));
  return { paymentId: payment.id, pix, payment };
}

export async function getPayment(id: string, paymentId: string) {
  return readJson<Payment>(await call(id, "/v3/payments/" + encodeURIComponent(paymentId)));
}

export async function getWebhookSecret(id: string) {
  const cfg = await getConfig(id);
  if (!cfg.webhook_secret) throw new Error("Webhook Asaas não configurado");
  return cfg.webhook_secret;
}

export function statusToLocal(status?: string) {
  if (status === "RECEIVED") return "PAID";
  if (status === "REFUNDED") return "REFUNDED";
  if (status === "OVERDUE") return "EXPIRED";
  return "PENDING";
}
