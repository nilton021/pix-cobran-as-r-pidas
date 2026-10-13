import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "drizzle/migrations/0021_delete_payment_integration.sql"),
    "utf8",
  );
}

describe("0021 delete payment integration migration", () => {
  it("checks authentication and ownership before checking pending charges", () => {
    const sql = readMigration();
    const auth = sql.indexOf("if v_user_id is null then");
    const owner = sql.indexOf("if not exists (");
    const pending = sql.indexOf("from public.charges c");
    const secretDelete = sql.indexOf("delete from vault.secrets");

    expect(auth).toBeGreaterThanOrEqual(0);
    expect(owner).toBeGreaterThan(auth);
    expect(pending).toBeGreaterThan(owner);
    expect(secretDelete).toBeGreaterThan(pending);
  });

  it("blocks deletion when this integration has PENDING charges", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /from public\.charges c[\s\S]*?where c\.payment_integration_id = p_integration_id[\s\S]*?and c\.status = 'PENDING'/,
    );
    expect(sql).toContain(
      "Existem cobranças pendentes nesta integração. Cancele-as ou aguarde o pagamento antes de excluir.",
    );
    expect(sql).toMatch(
      /if exists \([\s\S]*?raise exception 'Existem cobranças pendentes nesta integração[\s\S]*?end if;/,
    );
  });

  it("uses the exact integration-specific Vault secret prefix", () => {
    const sql = readMigration();

    expect(sql).toContain("v_prefix := 'pix_' || p_integration_id::text || '_';");
    expect(sql).toContain("left(s.name, length(v_prefix)) = v_prefix");
  });

  it("deletes only matching Vault secrets", () => {
    const sql = readMigration();
    const deletes = sql.match(/\bdelete\s+from\b/gi) ?? [];

    expect(deletes).toHaveLength(1);
    expect(sql).toMatch(
      /delete from vault\.secrets s[\s\S]*?left\(s\.name, length\(v_prefix\)\) = v_prefix/,
    );
  });

  it("preserves the integration row and marks it INACTIVE", () => {
    const sql = readMigration();

    expect(sql).not.toMatch(/delete\s+from\s+public\.payment_integrations/i);
    expect(sql).toMatch(
      /update public\.payment_integrations[\s\S]*?set status = 'INACTIVE'/,
    );
  });

  it("grants function execution only to authenticated", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /revoke all on function public\.delete_payment_integration\(uuid\) from public, anon;/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.delete_payment_integration\(uuid\) to authenticated;/i,
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.delete_payment_integration\(uuid\) to (public|anon|service_role)/i,
    );
  });
});
