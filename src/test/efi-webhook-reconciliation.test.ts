import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Efí webhook and reconciliation contracts", () => {
  it("exposes the public Efí webhook and validates HMAC before confirmation", () => {
    const route = readRepoFile("src/routes/api/public/efi-webhook.ts");
    expect(route).toContain('createFileRoute("/api/public/efi-webhook")');
    expect(route).toContain('searchParams.get("hmac")');
    expect(route).toContain("getWebhookHmac");
    expect(route).toContain("safeEqual");
    expect(route).toContain('provider_charge_id", txid');
    expect(route).toContain('payment_integrations.provider", "EFI"');
    expect(route).toContain("getCharge(charge.payment_integration_id, txid)");
    expect(route).toContain("Math.round(Number(remoteValue) * 100) !== charge.amount_cents");
    expect(route).toContain('status: "PAID"');
    expect(route).toContain('.eq("status", "PENDING")');
  });

  it("reconciles pending Efí charges through the provider API", () => {
    const route = readRepoFile("src/routes/api/public/reconcile-charges.ts");
    expect(route).toContain('["PICPAY", "EFI"]');
    expect(route).toContain('provider === "EFI"');
    expect(route).toContain("getCharge(r.payment_integration_id, r.provider_charge_id)");
    expect(route).toContain("statusToLocal(remote.status)");
    expect(route).toContain("r.amount_cents");
  });

  it("keeps the Efí webhook registration URL compatible with /pix suppression", () => {
    const efi = readRepoFile("src/lib/efi.server.ts");
    expect(efi).toContain("x-skip-mtls-checking");
    expect(efi).toContain("ignorar=");
    expect(efi).toContain("hmac=");
  });
});
