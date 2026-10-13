import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Payment = { id: string; status?: string; externalReference?: string; value?: number };
type PixCode = { encodedImage?: string; payload?: string; expirationDate?: string };

async function getConfig(id: string) {
  const { data, error } = await supabaseAdmin.rpc("get_asaas_integration_credentials", {
    p_integration_id: id,
  });
  const row = data?.[0];
  if (error || !row) {
    // Log diagnostics only; never log credentials or Vault values.
    console.error("[asaas] getConfig falhou", {
      integrationId: id,
      code: error?.code,
      message: error?.message,
      hasRow: Boolean(row),
    });
    throw new Error("Integração Asaas não configurada");
  }
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
    "user-agent": "PixCobrancasRapidas/1.0",
  };
  headers["access_" + "token"] = cfg.api_key;
  return fetch(origin(cfg.environment) + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
}

async function readJson<T>(res: Response, step: string): Promise<T> {
  const body = await res.text();
  if (!res.ok) {
    let detail = "";
    try {
      const errors = (JSON.parse(body) as {
        errors?: Array<{ code?: string; description?: string }>;
      }).errors;
      detail = (errors ?? [])
        .map((e) => `${e.code ?? "erro"}: ${e.description ?? ""}`)
        .join("; ")
        .slice(0, 300);
    } catch {
      /* corpo não-JSON */
    }
    console.error("[asaas] resposta de erro", { step, status: res.status, detail });
    throw new Error(`Asaas respondeu ${res.status} (${step})${detail ? ": " + detail : ""}`);
  }
  return JSON.parse(body) as T;
}

export async function createPixCharge(id: string, input: {
  externalReference: string; name: string; email: string; document: string;
  amountCents: number; description?: string | undefined; expirationSeconds: number;
}) {
  const lookup = await readJson<{ data: Array<{ id: string }> }>(
    await call(id, "/v3/customers?email=" + encodeURIComponent(input.email)),
    "cliente-busca",
  );
  let customer = lookup.data?.[0];
  if (!customer) {
    customer = await readJson<{ id: string }>(await call(id, "/v3/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name, email: input.email, cpfCnpj: input.document,
        externalReference: input.externalReference,
      }),
    }), "cliente-criar");
  }

  const dueDate = new Date(Date.now() + input.expirationSeconds * 1000).toISOString().slice(0, 10);
  const payment = await readJson<Payment>(await call(id, "/v3/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id, billingType: "PIX", value: input.amountCents / 100,
      dueDate, description: input.description?.slice(0, 500),
      externalReference: input.externalReference,
    }),
  }), "cobranca");

  const pix = await readJson<PixCode>(await call(id, "/v3/payments/" + encodeURIComponent(payment.id) + "/pixQrCode"), "pixQrCode");
  return { paymentId: payment.id, pix, payment };
}

export async function getPayment(id: string, paymentId: string) {
  return readJson<Payment>(await call(id, "/v3/payments/" + encodeURIComponent(paymentId)), "consulta-cobranca");
}

export type CancellationResult = "CANCELED" | "PAID";

function isPaidStatus(status?: string) {
  return status === "RECEIVED" || status === "CONFIRMED";
}

/**
 * Cancela uma cobrança Asaas somente após consultar seu estado remoto.
 * Se a resposta do DELETE não confirmar o cancelamento, a função consulta
 * novamente e falha sem presumir que a cobrança foi cancelada.
 */
export async function cancelPayment(id: string, paymentId: string): Promise<CancellationResult> {
  const current = await getPayment(id, paymentId);
  if (isPaidStatus(current.status)) return "PAID";
  if (current.status === "DELETED") return "CANCELED";

  const response = await call(id, "/v3/payments/" + encodeURIComponent(paymentId), {
    method: "DELETE",
  });

  if (!response.ok) {
    await readJson<Payment>(response, "cancelamento-cobranca");
  } else {
    const body = await response.text();
    if (body) {
      let deleted: Payment | undefined;
      try { deleted = JSON.parse(body) as Payment; } catch { /* confirmar via GET abaixo */ }
      if (isPaidStatus(deleted?.status)) return "PAID";
      if (deleted?.status === "DELETED") return "CANCELED";
    }
  }

  // A resposta do DELETE pode não conter o estado final. Nunca inferir sucesso.
  const confirmed = await getPayment(id, paymentId);
  if (isPaidStatus(confirmed.status)) return "PAID";
  if (confirmed.status === "DELETED") return "CANCELED";
  throw new Error("O Asaas não confirmou o cancelamento da cobrança");
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
