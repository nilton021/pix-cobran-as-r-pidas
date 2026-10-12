import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Asaas service-role JWT claim compatibility migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "drizzle/migrations/0022_asaas_service_role_claims.sql"),
    "utf8",
  );

  it("accepts the legacy role claim and falls back to the JSON claims role", () => {
    expect(sql).toContain("current_setting('request.jwt.claim.role', true)");
    expect(sql).toContain("current_setting('request.jwt.claims', true)");
    expect(sql).toContain("::jsonb ->> 'role'");
    expect(sql).toContain("<> 'service_role'");
  });

  it("keeps credential retrieval restricted to service_role", () => {
    expect(sql).toContain("revoke all on function public.get_asaas_integration_credentials(uuid)");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.get_asaas_integration_credentials(uuid)");
    expect(sql).toContain("to service_role");
  });

  it("is wired into the apply workflow with an idempotent existence check", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/apply-phase-22-migrations.yml"),
      "utf8",
    );
    expect(workflow).toContain("migration_0022_done");
    expect(workflow).toContain("drizzle/migrations/0022_asaas_service_role_claims.sql");
  });

  it("does not weaken provider or active-integration checks", () => {
    expect(sql).toContain("pi.provider = 'ASAAS'");
    expect(sql).toContain("pi.status = 'ACTIVE'");
    expect(sql).toContain("where s.name = 'pix_' || pi.id::text || '_api_key'");
    expect(sql).toContain("where s.name = 'pix_' || pi.id::text || '_webhook_secret'");
  });
});
