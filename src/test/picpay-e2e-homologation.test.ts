import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("phase 20 PicPay homologation E2E contracts", () => {
  it("keeps the create-charge flow bound to the linked PicPay integration", () => {
    const route = readRepoFile("src/routes/api/v1/charges.ts");
    const picpay = readRepoFile("src/lib/picpay.server.ts");
    expect(route).toContain("const integrationId = integrations[0]!.id;");
    expect(route).toContain("payment_integration_id: integrationId");
    expect(route).toContain("merchantChargeId: charge.id");
    expect(route).toContain("await createPixCharge(integrationId");
    expect(picpay).toContain('picpayFetch(integrationId, "/charge/pix"');
    expect(picpay).toContain("transactions: [{ amount: input.amountCents, pix: { expiration: input.expirationSeconds } }]");
  });

  it("keeps the charge lookup and reconciliation integration aware", () => {
    const route = readRepoFile("src/routes/api/v1/charges/$id.ts");
    const reconcile = readRepoFile("src/routes/api/public/reconcile-charges.ts");
    const picpay = readRepoFile("src/lib/picpay.server.ts");
    expect(route).toContain('.eq("account_id", auth.accountId)');
    expect(reconcile).toContain('.not("payment_integration_id", "is", null)');
    expect(reconcile).toContain("getPicPayCharge(r.payment_integration_id, r.id)");
    expect(picpay).toContain("export async function getCharge(\n  integrationId: string,");
  });

  it("accepts PAID only for a PIX transaction with the exact charge amount", () => {
    const picpay = readRepoFile("src/lib/picpay.server.ts");
    expect(picpay).toContain('if (tx?.paymentType !== "PIX") throw new Error("Confirmação PAID não é PIX");');
    expect(picpay).toContain('if (tx.amount !== current.amount_cents) throw new Error("Valor pago divergente da cobrança");');
    expect(picpay).toContain("tx?.updatedAt");
    expect(picpay).toContain('update["paid_at"]');
  });

  it("authenticates the webhook before provider confirmation", () => {
    const webhook = readRepoFile("src/routes/api/public/picpay-webhook.ts");
    expect(webhook).toContain("getPicPayWebhookSecret(charge.payment_integration_id)");
    expect(webhook).toContain("safeEqual(raw, expected)");
    expect(webhook).toContain('await supabaseAdmin.from("webhook_events").insert');
    expect(webhook).toContain("await getCharge(charge.payment_integration_id, merchantChargeId)");
    expect(webhook.indexOf("safeEqual(raw, expected)")).toBeLessThan(webhook.indexOf("await getCharge(charge.payment_integration_id, merchantChargeId)"));
  });

  it("protects cron reconciliation with the internal secret", () => {
    const reconcile = readRepoFile("src/routes/api/public/reconcile-charges.ts");
    expect(reconcile).toContain('.eq("key", "cron_secret")');
    expect(reconcile).toContain("safeEqual(provided, cfg.value)");
    expect(reconcile).toContain('new Response("Unauthorized", { status: 401 })');
  });

  it("keeps PicPay environment and API path explicit for homologation", () => {
    const picpay = readRepoFile("src/lib/picpay.server.ts");
    expect(picpay).toContain('process.env["PICPAY_API_BASE_URL"]');
    expect(picpay).toContain('process.env["PICPAY_API_PATH"]?.trim()');
    expect(picpay).toContain("fetchToken(integrationId)");
    expect(picpay).toContain("${base}/oauth2/token");
    expect(picpay).toContain("tokenCache.set(integrationId");
  });

  it("prevents non-PicPay providers from accepting PAID without exact value", () => {
    const source = readRepoFile("src/lib/charges.functions.ts");
    expect(source).toContain('Math.round(Number(paidValue) * 100) !== owned.amount_cents');
    expect(source).toContain('Math.round(remote.value * 100) !== owned.amount_cents');
    expect(source).toContain('.neq("status", "PAID")');
  });

  it("allows only valid post-paid PicPay transitions", () => {
    const picpay = readRepoFile("src/lib/picpay.server.ts");
    expect(picpay).toContain('const AFTER_PAID = new Set(["REFUNDED", "PARTIAL", "CHARGEBACK"]);');
    expect(picpay).toContain('if (current.status === "PAID" && !AFTER_PAID.has(next)) return current;');
    expect(picpay).toContain('.eq("status", current.status)');
  });
});
