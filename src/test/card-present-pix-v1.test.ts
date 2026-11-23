import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
const fixture = vi.hoisted(() => {
  const row: Record<string, unknown> = {
    id: "10000000-0000-4000-8000-000000000001",
    account_id: "20000000-0000-4000-8000-000000000001",
    amount_cents: 1500,
    description: "Pedido Pix",
    status: "PENDING",
    picpay_charge_id: "picpay_1",
    qr_code: "pix_fixture",
    qr_code_base64: "fixture",
    end_to_end_id: null,
    payer: null,
    expires_at: "2026-11-23T01:00:00Z",
    paid_at: null,
    created_at: "2026-11-23T00:00:00Z",
    updated_at: "2026-11-23T00:00:00Z",
    payment_method: "PIX",
  };
  const eq = vi.fn();
  let columns = "";
  const db = {
    select: vi.fn((c: string) => {
      columns = c;
      return db;
    }),
    eq: vi.fn((...args: unknown[]) => {
      eq(...args);
      return db;
    }),
    maybeSingle: vi.fn(async () => ({
      data: Object.fromEntries(
        columns
          .split(",")
          .map((c) => c.trim())
          .map((c) => [c, row[c]]),
      ),
      error: null,
    })),
  };
  return {
    row,
    eq,
    db,
    authenticate: vi.fn(async () => ({ apiKeyId: "key_1", accountId: row["account_id"] })),
    audit: vi.fn(async () => {}),
  };
});
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => fixture.db },
}));
vi.mock("@/lib/api-key-auth.server", () => ({ authenticateApiKey: fixture.authenticate }));
vi.mock("@/lib/api-audit.server", () => ({
  createApiAuditContext: () => ({}),
  recordApiAudit: fixture.audit,
}));
vi.mock("@/lib/api-rate-limit.server", () => ({
  consumeApiRateLimit: async () => ({ allowed: true }),
  rateLimitResponse: () => null,
}));
import { Route } from "@/routes/api/v1/charges/$id";
beforeEach(() => vi.clearAllMocks());
describe("Existing v1 Pix response (mocked dependencies, no provider calls)", () => {
  it("preserves the exact existing read projection after a PIX method column is added", async () => {
    const options = Route.options as unknown as {
      server: {
        handlers: { GET: (ctx: { request: Request; params: { id: string } }) => Promise<Response> };
      };
    };
    const response = await options.server.handlers.GET({
      request: new Request("http://localhost/api/v1/charges/id"),
      params: { id: String(fixture.row["id"]) },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: fixture.row["id"],
      amount_cents: 1500,
      description: "Pedido Pix",
      status: "PENDING",
      picpay_charge_id: "picpay_1",
      qr_code: "pix_fixture",
      qr_code_base64: "fixture",
      end_to_end_id: null,
      payer: null,
      expires_at: "2026-11-23T01:00:00Z",
      paid_at: null,
      created_at: "2026-11-23T00:00:00Z",
      updated_at: "2026-11-23T00:00:00Z",
    });
    expect(fixture.eq).toHaveBeenCalledWith("account_id", fixture.row["account_id"]);
  });
  it("does not pretend an existing /api/v2/charges implementation was tested", () => {
    expect(existsSync("src/routes/api/v2/charges.ts")).toBe(false);
    expect(existsSync("src/routes/api/v2/charges/index.ts")).toBe(false);
  });
});
