import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("phase 19 security isolation contracts", () => {
  it("enforces tenant ownership on multi-tenant RLS policies", () => {
    const foundation = readRepoFile("drizzle/migrations/0003_multi_tenant_payment_foundation.sql");
    const hardening = readRepoFile("drizzle/migrations/0004_multi_tenant_rls_hardening.sql");
    const customerWebhooks = readRepoFile("drizzle/migrations/0007_customer_webhooks.sql");

    expect(foundation).toContain('using (\n  exists (\n    select 1\n    from public.accounts a\n    where a.id = payment_integrations.account_id\n      and a.owner_id = auth.uid()');
    expect(foundation).toContain('with check (\n  exists (\n    select 1\n    from public.accounts a\n    where a.id = payment_integrations.account_id\n      and a.owner_id = auth.uid()');
    expect(foundation).toContain('using (\n  exists (\n    select 1\n    from public.accounts a\n    where a.id = api_keys.account_id\n      and a.owner_id = auth.uid()');
    expect(customerWebhooks).toContain('where a.id = customer_webhook_endpoints.account_id\n      and a.owner_id = auth.uid()');
    expect(hardening).toContain("revoke insert on public.api_keys from authenticated;");
    expect(hardening).toContain("revoke delete on public.api_keys from authenticated;");
  });

  it("does not expose API key hashes to authenticated clients", () => {
    const foundation = readRepoFile("drizzle/migrations/0003_multi_tenant_payment_foundation.sql");
    expect(foundation).toContain("grant select (");
    expect(foundation).toContain("key_prefix,");
    expect(foundation).not.toMatch(/grant select \([^)]*key_hash/s);
  });

  it("derives the tenant from the authenticated API key", () => {
    const auth = readRepoFile("src/lib/api-key-auth.server.ts");
    const createCharge = readRepoFile("src/routes/api/v1/charges.ts");
    const getCharge = readRepoFile("src/routes/api/v1/charges/$id.ts");

    expect(auth).toContain(".select(\"id, account_id, expires_at, revoked_at\")");
    expect(auth).toContain("return { apiKeyId: key.id, accountId: key.account_id };");
    expect(createCharge).toContain("const auth = await authenticateApiKey(request);");
    expect(createCharge).toContain(".eq(\"id\", auth.accountId)");
    expect(createCharge).toContain("account_id: account.id");
    expect(getCharge).toContain(".eq(\"account_id\", auth.accountId)");
    expect(createCharge).not.toContain("schema.parse({ ...input, accountId");
  });

  it("keeps Vault credential getters restricted to service_role", () => {
    const credentials = readRepoFile("drizzle/migrations/0005_picpay_vault_secure_function.sql");
    const webhookSecret = readRepoFile("drizzle/migrations/0006_picpay_webhook_secret_function.sql");
    const customerSecret = readRepoFile("drizzle/migrations/0007_customer_webhooks.sql");

    for (const sql of [credentials, webhookSecret, customerSecret]) {
      expect(sql).toContain("current_setting('request.jwt.claim.role', true), '') <> 'service_role'");
      expect(sql).toContain("revoke all on function");
      expect(sql).toContain("from public, anon, authenticated");
      expect(sql).toContain("grant execute on function");
      expect(sql).toContain("to service_role");
    }
  });

  it("keeps charges read access tenant-scoped at the database layer", () => {
    const foundation = readRepoFile("drizzle/migrations/0000_migration.sql");
    expect(foundation).toContain('create policy "own charges select"');
    expect(foundation).toContain("where a.id = charges.account_id and a.owner_id = auth.uid()");
  });
});
