// Integração PicPay Business (somente servidor). Nunca importe isto no cliente.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type TokenCache = { token: string; expiresAt: number };
type PicPayCredentials = { integrationId: string; environment: string; clientId: string; clientSecret: string };
const tokenCache = new Map<string, TokenCache>();
const pendingTokens = new Map<string, Promise<string>>();

async function getCredentials(integrationId: string): Promise<PicPayCredentials> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(integrationId)) {
    throw new Error("payment_integration_id inválido");
  }
  const { data, error } = await supabaseAdmin.rpc("get_picpay_integration_credentials", {
    p_integration_id: integrationId,
  });
  if (error || !data?.[0]?.client_id || !data[0].client_secret) {
    throw new Error("Credenciais PicPay não configuradas");
  }
  return {
    integrationId,
    environment: data[0].environment,
    clientId: data[0].client_id,
    clientSecret: data[0].client_secret,
  };
}

function cfg() {
  const base = process.env["PICPAY_API_BASE_URL"];
  if (!base) throw new Error("PICPAY_API_BASE_URL não configurado");
  const apiPath = process.env["PICPAY_API_PATH"]?.trim();
  if (!apiPath) throw new Error("PICPAY_API_PATH não configurado");
  const normalizedApiPath = `/${apiPath.replace(/^\/+|\/+$/g, "")}`;
  return { base: base.replace(/\/+$/, ""), apiPath: normalizedApiPath };
}

async function fetchToken(integrationId: string): Promise<string> {
  const { base } = cfg();
  const { clientId, clientSecret } = await getCredentials(integrationId);
  const res = await fetch(`${base}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    console.error("[picpay] falha ao obter token", res.status);
    throw new Error(`Falha na autenticação PicPay (${res.status})`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = (json.expires_in ?? 300) * 1000;
  tokenCache.set(integrationId, { token: json.access_token, expiresAt: Date.now() + ttl - 30_000 });
  return json.access_token;
}

export async function getToken(integrationId: string): Promise<string> {
  const cached = tokenCache.get(integrationId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const pending = pendingTokens.get(integrationId);
  if (pending) return pending;
  const next = fetchToken(integrationId).finally(() => pendingTokens.delete(integrationId));
  pendingTokens.set(integrationId, next);
  return next;
}

async function picpayFetch(integrationId: string, path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const { base, apiPath } = cfg();
  const token = await getToken(integrationId);
  const res = await fetch(`${base}${apiPath}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && !retried) {
    tokenCache.delete(integrationId);
    return picpayFetch(integrationId, path, init, true);
  }
  return res;
}

export class PicPayError extends Error {
  constructor(message: string, public status: number, public body: string) { super(message); }
}

export function sanitizeName(name: string): string {
  const clean = name.replace(/[^\p{L} &\d]/gu, "").replace(/\s+/g, " ").trim();
  return clean || "Cliente";
}

export type PicPayCharge = {
  id?: string;
  chargeStatus?: string;
  merchantChargeId?: string;
  transactions?: Array<{
    status?: string;
    transactionStatus?: string;
    paymentType?: string;
    amount?: number;
    originalAmount?: number;
    refundedAmount?: number;
    updatedAt?: string;
    pix?: { qrCode?: string; qrCodeBase64?: string; endToEndId?: string; payer?: unknown; expiration?: number };
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

export async function createPixCharge(integrationId: string, input: {
  merchantChargeId: string;
  customer: { name: string; email: string; documentType: "CPF" | "CNPJ"; document: string };
  amountCents: number;
  expirationSeconds: number;
}): Promise<PicPayCharge> {
  const body = {
    paymentSource: "GATEWAY",
    merchantChargeId: input.merchantChargeId,
    customer: { ...input.customer, name: sanitizeName(input.customer.name) },
    transactions: [{ amount: input.amountCents, pix: { expiration: input.expirationSeconds } }],
  };
  const res = await picpayFetch(integrationId, "/charge/pix", { method: "POST", body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    console.error("[picpay] createPixCharge erro", res.status, text.slice(0, 500));
    throw new PicPayError(`PicPay respondeu ${res.status}`, res.status, text);
  }
  return JSON.parse(text) as PicPayCharge;
}

export async function getCharge(integrationId: string, merchantChargeId: string): Promise<PicPayCharge> {
  const res = await picpayFetch(integrationId, `/charge/${encodeURIComponent(merchantChargeId)}`, { method: "GET" });
  const text = await res.text();
  if (!res.ok) {
    console.error("[picpay] getCharge erro", res.status, text.slice(0, 500));
    throw new PicPayError(`PicPay respondeu ${res.status}`, res.status, text);
  }
  return JSON.parse(text) as PicPayCharge;
}

const FINAL = new Set(["PAID", "CANCELED", "DENIED", "ERROR", "REFUNDED", "CHARGEBACK"]);
const KNOWN = new Set(["PENDING", "PAID", "EXPIRED", "CANCELED", "DENIED", "ERROR", "REFUNDED", "PARTIAL", "CHARGEBACK"]);

export type ChargeStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELED" | "DENIED" | "ERROR" | "REFUNDED" | "PARTIAL" | "CHARGEBACK";

export function mapStatus(chargeStatus?: string, transactionStatus?: string): ChargeStatus {
  const cs = (chargeStatus ?? "").toUpperCase();
  const ts = (transactionStatus ?? "").toUpperCase();
  if (FINAL.has(cs)) return cs as ChargeStatus;
  if (cs === "PARTIAL" || cs === "PARTIALLY_REFUNDED") return "PARTIAL";
  if (cs === "PRE_AUTHORIZED" || cs === "PENDING" || cs === "") {
    if (ts === "PARTIALLY_REFUNDED") return "PARTIAL";
    if (KNOWN.has(ts)) return ts as ChargeStatus;
  }
  console.warn("[picpay] status não reconhecido", { chargeStatus, transactionStatus });
  return "PENDING";
}

export async function applyStatus(chargeId: string, remote: PicPayCharge, opts: { forceExpired?: boolean } = {}) {
  const { data: current, error } = await supabaseAdmin.from("charges").select("*").eq("id", chargeId).single();
  if (error || !current) throw new Error("Cobrança não encontrada");

  const tx = remote.transactions?.[0];
  let next = mapStatus(remote.chargeStatus, tx?.status ?? tx?.transactionStatus);
  if (opts.forceExpired && next === "PENDING") next = "EXPIRED";

  if (current.status === "PAID" && (next === "PENDING" || next === "EXPIRED")) return current;

  if (next === "PAID") {
    if (tx?.paymentType !== "PIX") throw new Error("Confirmação PAID não é PIX");
    if (tx.amount !== current.amount_cents) throw new Error("Valor pago divergente da cobrança");
  }

  const update: Record<string, unknown> = { status: next };
  if (next === "PAID" && !current.paid_at) {
    const paidAt = tx?.updatedAt ? new Date(tx.updatedAt) : null;
    update.paid_at = paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt.toISOString() : new Date().toISOString();
  }
  if (remote.id && !current.picpay_charge_id) update.picpay_charge_id = remote.id;
  if (tx?.pix?.endToEndId) update.end_to_end_id = tx.pix.endToEndId;
  if (tx?.pix?.payer) update.payer = tx.pix.payer;

  const { data, error: upErr } = await supabaseAdmin
    .from("charges")
    .update(update)
    .eq("id", chargeId)
    .neq("status", "PAID")
    .select()
    .maybeSingle();

  if (upErr) throw upErr;
  if (!data) {
    const { data: latest } = await supabaseAdmin.from("charges").select("*").eq("id", chargeId).single();
    return latest;
  }

  if (current.status !== next) console.log("[picpay] status atualizado", { chargeId, from: current.status, to: next });
  if (current.status !== next) {
    const { deliverCustomerWebhook } = await import("@/lib/customer-webhooks.server");
    await deliverCustomerWebhook(data);
  }
  return data;
}

export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function getPicPayWebhookSecret(integrationId: string): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(integrationId)) {
    throw new Error("payment_integration_id inválido");
  }
  const { data, error } = await supabaseAdmin.rpc("get_picpay_webhook_secret", {
    p_integration_id: integrationId,
  });
  if (error || !data) throw new Error("Webhook secret PicPay não configurado");
  return data as string;
}
