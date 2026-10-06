// Integração PicPay Business (somente servidor). Nunca importe isto no cliente.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type TokenCache = { token: string; expiresAt: number };
let cache: TokenCache | null = null;
let pending: Promise<string> | null = null;

function cfg() {
  const base = process.env["PICPAY_API_BASE_URL"];
  const clientId = process.env["PICPAY_CLIENT_ID"];
  const clientSecret = process.env["PICPAY_CLIENT_SECRET"];
  if (!base || !clientId || !clientSecret) {
    throw new Error("Credenciais PicPay não configuradas");
  }
  const apiPath = (process.env["PICPAY_API_PATH"] ?? "/v1").trim();
  const normalizedApiPath = `/${apiPath.replace(/^\/+|\/+$/g, "")}`;
  return { base: base.replace(/\/+$/, ""), apiPath: normalizedApiPath, clientId, clientSecret };
}

async function fetchToken(): Promise<string> {
  const { base, clientId, clientSecret } = cfg();
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
  // Renova 30s antes de expirar
  cache = { token: json.access_token, expiresAt: Date.now() + ttl - 30_000 };
  return json.access_token;
}

export async function getToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.token;
  // Compartilha a mesma Promise entre chamadas concorrentes
  if (!pending) pending = fetchToken().finally(() => { pending = null; });
  return pending;
}

async function picpayFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const { base, apiPath } = cfg();
  const token = await getToken();
  const res = await fetch(`${base}${apiPath}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && !retried) {
    cache = null;
    return picpayFetch(path, init, true);
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
    pix?: { qrCode?: string; qrCodeBase64?: string; endToEndId?: string; payer?: unknown; expiration?: number };
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

export async function createPixCharge(input: {
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
  const res = await picpayFetch("/charge/pix", { method: "POST", body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    console.error("[picpay] createPixCharge erro", res.status, text.slice(0, 500));
    throw new PicPayError(`PicPay respondeu ${res.status}`, res.status, text);
  }
  return JSON.parse(text) as PicPayCharge;
}

export async function getCharge(merchantChargeId: string): Promise<PicPayCharge> {
  const res = await picpayFetch(`/charge/${encodeURIComponent(merchantChargeId)}`, { method: "GET" });
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
  if (cs === "PARTIAL") return "PARTIAL";
  if (cs === "PRE_AUTHORIZED" || cs === "PENDING" || cs === "") {
    if (KNOWN.has(ts)) return ts as ChargeStatus;
  }
  console.warn("[picpay] status não reconhecido", { chargeStatus, transactionStatus });
  return "PENDING";
}

// Aplica o status vindo da API; nunca regride PAID para PENDING/EXPIRED.
export async function applyStatus(chargeId: string, remote: PicPayCharge, opts: { forceExpired?: boolean } = {}) {
  const { data: current, error } = await supabaseAdmin.from("charges").select("*").eq("id", chargeId).single();
  if (error || !current) throw new Error("Cobrança não encontrada");

  const tx = remote.transactions?.[0];
  let next = mapStatus(remote.chargeStatus, tx?.status ?? tx?.transactionStatus);
  if (opts.forceExpired && next === "PENDING") next = "EXPIRED";
  if (current.status === "PAID" && (next === "PENDING" || next === "EXPIRED")) next = "PAID";

  const update: Record<string, unknown> = { status: next };
  if (next === "PAID" && !current.paid_at) update.paid_at = new Date().toISOString();
  if (remote.id && !current.picpay_charge_id) update.picpay_charge_id = remote.id;
  if (tx?.pix?.endToEndId) update.end_to_end_id = tx.pix.endToEndId;
  if (tx?.pix?.payer) update.payer = tx.pix.payer;

  const { data, error: upErr } = await supabaseAdmin.from("charges").update(update).eq("id", chargeId).select().single();
  if (upErr) throw upErr;
  if (current.status !== next) console.log("[picpay] status atualizado", { chargeId, from: current.status, to: next });
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
