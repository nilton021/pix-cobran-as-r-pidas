import https from "node:https";
import { Buffer } from "node:buffer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type EfiConfig = {
  environment: string;
  client_id: string;
  client_secret: string;
  certificate_base64: string;
  certificate_password?: string;
  pix_key: string;
  webhook_hmac: string;
};

type Token = { token: string; expiresAt: number };
const cache = new Map<string, Token>();
const pending = new Map<string, Promise<string>>();

async function config(id: string): Promise<EfiConfig> {
  const { data, error } = await (supabaseAdmin as any).rpc("get_efi_integration_credentials", {
    p_integration_id: id,
  });
  const c = data?.[0] as EfiConfig | undefined;
  if (
    error ||
    !c?.client_id ||
    !c.client_secret ||
    !c.certificate_base64 ||
    !c.pix_key ||
    !c.webhook_hmac
  ) {
    throw new Error("Integração Efí Bank não configurada");
  }
  return c;
}

function base(environment: string) {
  return environment === "SANDBOX"
    ? "https://pix-h.api.efipay.com.br"
    : "https://pix.api.efipay.com.br";
}

function request(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    certificate: string;
    password?: string;
  },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      u,
      {
        method: opts.method ?? "GET",
        pfx: Buffer.from(opts.certificate, "base64"),
        passphrase: opts.password ?? "",
        minVersion: "TLSv1.2",
        headers: opts.headers ?? {},
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function token(id: string) {
  const c = await config(id);
  const hit = cache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.token;

  const existing = pending.get(id);
  if (existing) return existing;

  const next = (async () => {
    const auth = Buffer.from(c.client_id + ":" + c.client_secret, "utf8").toString("base64");
    const res = await request(base(c.environment) + "/oauth/token", {
      method: "POST",
      certificate: c.certificate_base64,
      password: c.certificate_password,
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error("Falha na autenticação Efí Bank (" + res.status + ")");
    }

    const payload = JSON.parse(res.body) as { access_token: string; expires_in?: number };
    cache.set(id, {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max((payload.expires_in ?? 300) - 60, 30) * 1000,
    });
    return payload.access_token;
  })().finally(() => pending.delete(id));

  pending.set(id, next);
  return next;
}

async function call(id: string, path: string, method = "GET", body?: unknown) {
  const c = await config(id);
  const accessToken = await token(id);
  const headers: Record<string, string> = {
    Authorization: "Bearer " + accessToken,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const doRequest = (tokenValue: string) =>
    request(base(c.environment) + path, {
      method,
      certificate: c.certificate_base64,
      password: c.certificate_password,
      headers: { ...headers, Authorization: "Bearer " + tokenValue },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await doRequest(accessToken);
  if (res.status === 401) {
    cache.delete(id);
    res = await doRequest(await token(id));
  }

  if (res.status < 200 || res.status >= 300) {
    throw new Error("Efí Bank respondeu " + res.status + ": " + res.body.slice(0, 300));
  }

  return res.body ? JSON.parse(res.body) : {};
}

export async function createPixCharge(
  id: string,
  input: { amountCents: number; description?: string; expirationSeconds: number; externalReference: string },
) {
  const txid = input.externalReference.replace(/-/g, "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 35).padEnd(26, "0");
  const result = (await call(id, "/v2/cob/" + txid, "PUT", {
    calendario: {
      expiracao: Math.min(Math.max(input.expirationSeconds, 1), 31536000),
    },
    valor: {
      original: (input.amountCents / 100).toFixed(2),
    },
    chave: (await config(id)).pix_key,
    solicitacaoPagador: (input.description ?? "Pagamento").slice(0, 140),
  })) as {
    txid?: string;
    status?: string;
    pixCopiaECola?: string;
  };

  return {
    txid: result.txid ?? txid,
    paymentId: result.txid ?? txid,
    pixCopiaECola: result.pixCopiaECola,
    status: result.status,
  };
}

export async function getCharge(id: string, txid: string) {
  return call(id, "/v2/cob/" + encodeURIComponent(txid));
}

export async function getWebhookHmac(id: string) {
  const c = await config(id);
  return c.webhook_hmac;
}

export async function registerWebhook(id: string, url: string) {
  const c = await config(id);
  const webhookUrl = url.includes("?")
    ? url + "&ignorar="
    : url + "?ignorar=";
  return callWithWebhookHeader(id, "/v2/webhook/" + encodeURIComponent(c.pix_key), webhookUrl);
}

async function callWithWebhookHeader(id: string, path: string, webhookUrl: string) {
  const c = await config(id);
  const accessToken = await token(id);
  const res = await request(base(c.environment) + path, {
    method: "PUT",
    certificate: c.certificate_base64,
    password: c.certificate_password,
    headers: {
      Authorization: "Bearer " + accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-skip-mtls-checking": "true",
    },
    body: JSON.stringify({ webhookUrl: webhookUrl + (webhookUrl.includes("hmac=") ? "" : "&hmac=" + encodeURIComponent(c.webhook_hmac)) }),
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error("Falha ao configurar webhook Efí (" + res.status + "): " + res.body.slice(0, 300));
  }
  return res.body ? JSON.parse(res.body) : {};
}

export function statusToLocal(status?: string) {
  if (status === "CONCLUIDA") return "PAID";
  if (status === "REMOVIDA_PELO_USUARIO_RECEBEDOR" || status === "REMOVIDA_PELO_PSP") return "CANCELED";
  return "PENDING";
}
