import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("legacy charge backfill migration", () => {
  it("only links legacy charges to exactly one active PicPay integration", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "drizzle/migrations/0014_charge_integration_backfill.sql"),
      "utf8",
    );

    expect(migration).toContain("c.payment_integration_id is null");
    expect(migration).toContain("pi.provider = 'PICPAY'");
    expect(migration).toContain("pi.status = 'ACTIVE'");
    expect(migration).toContain("not exists");
    expect(migration).toContain("pi2.id <> pi.id");
  });
});
