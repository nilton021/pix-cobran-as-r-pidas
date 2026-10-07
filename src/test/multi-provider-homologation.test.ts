import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("multi-provider homologation contracts", () => {
  const providers = ["PICPAY", "ASAAS", "INTER", "EFI"] as const;

  it("keeps all four providers enabled in the database constraint", () => {
    const migration = readRepoFile("drizzle/migrations/0017_multi_provider_payments.sql");
    for (const provider of providers) {
      expect(migration).toContain("'" + provider + "'");
    }
  });

  it("has a dedicated secure credential RPC for every provider added after PicPay", () => {
    expect(readRepoFile("drizzle/migrations/0017_multi_provider_payments.sql")).toContain("save_asaas_integration");
    expect(readRepoFile("drizzle/migrations/0018_banco_inter_pix.sql")).toContain("save_inter_integration");
    expect(readRepoFile("drizzle/migrations/0019_efi_pix.sql")).toContain("save_efi_integration");
  });

  it("keeps provider credentials behind service-role read functions", () => {
    for (const path of [
      "drizzle/migrations/0017_multi_provider_payments.sql",
      "drizzle/migrations/0018_banco_inter_pix.sql",
      "drizzle/migrations/0019_efi_pix.sql",
    ]) {
      const migration = readRepoFile(path);
      expect(migration).toContain("current_setting('request.jwt.claim.role'");
      expect(migration).toContain("service_role");
      expect(migration).toContain("revoke all on function");
    }
  });

  it("routes each provider to its own adapter and webhook", () => {
    const charges = readRepoFile("src/lib/charges.functions.ts");
    expect(charges).toContain('provider === "ASAAS"');
    expect(charges).toContain('provider === "INTER"');
    expect(charges).toContain('provider === "EFI"');

    expect(readRepoFile("src/lib/asaas.server.ts")).toContain("createPixCharge");
    expect(readRepoFile("src/lib/inter.server.ts")).toContain("createPixCharge");
    expect(readRepoFile("src/lib/efi.server.ts")).toContain("createPixCharge");

    expect(readRepoFile("src/routes/api/public/asaas-webhook.ts")).toContain("POST");
    expect(readRepoFile("src/routes/api/public/inter-webhook.ts")).toContain("POST");
    expect(readRepoFile("src/routes/api/public/efi-webhook.ts")).toContain("POST");
  });

  it("persists provider_charge_id for non-PicPay providers", () => {
    const charges = readRepoFile("src/lib/charges.functions.ts");
    expect(charges).toContain("provider_charge_id");
    expect(charges).toContain('provider === "EFI"');
    expect(charges).toContain('provider === "INTER"');
    expect(charges).toContain('provider === "ASAAS"');
  });

  it("keeps real credentials out of the repository", () => {
    const env = readRepoFile(".env.example");
    expect(env).toContain("SUPABASE_SERVICE_ROLE_KEY=\"\"");
    expect(env).toContain("PICPAY_CLIENT_SECRET=\"\"");
    expect(env).toContain("PICPAY_WEBHOOK_TOKEN=\"\"");
  });
});
