import { createHmac } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  cardInput,
  canTransition,
  isCardEnabled,
  methodOf,
  sessionResponse,
  type CardSession,
} from "@/lib/card-present/contracts";
import {
  boundedBody,
  hashCardInput,
  parseCardEvent,
  verifyCardSignature,
} from "@/lib/card-present/security.server";
import { mockCardAdapter } from "@/lib/card-present/adapter.server";
import {
  cardApi,
  cardWebhook,
  cardReconcile,
  type CardApiDependencies,
} from "@/lib/card-present/handlers.server";
import { CardConflict } from "@/lib/card-present/repository.server";

const account = "10000000-0000-4000-8000-000000000001";
const integration = "20000000-0000-4000-8000-000000000001";
const id = "30000000-0000-4000-8000-000000000001";
const session: CardSession = {
  id,
  charge_id: id,
  account_id: account,
  payment_integration_id: integration,
  provider: "MOCK",
  provider_session_id: `mock_${id}`,
  amount_cents: 1500,
  status: "AWAITING_CARD",
  created_at: "2026-11-23T00:00:00Z",
  updated_at: "2026-11-23T00:00:00Z",
  expires_at: "2026-11-23T00:15:00Z",
};
function deps(): CardApiDependencies {
  return {
    authenticate: vi.fn(async () => ({ accountId: account, apiKeyId: id })),
    limit: vi.fn(async () => true),
    create: vi.fn(async () => ({ session, replay: false })),
    read: vi.fn(async () => session),
    audit: vi.fn(async () => {}),
  };
}
function request(body: unknown = { integrationId: integration, amountCents: 1500 }) {
  return new Request("http://localhost/api/v2/card-present/sessions", {
    method: "POST",
    headers: { "Idempotency-Key": "request_1" },
    body: JSON.stringify(body),
  });
}
afterEach(() => vi.unstubAllEnvs());
describe("Card sandbox contracts (no database schema applied)", () => {
  it.each([undefined, "false", "TRUE", "1", "yes"])("flag %s keeps card disabled", (value) =>
    expect(isCardEnabled(value)).toBe(false),
  );
  it("requires explicit true", () => expect(isCardEnabled("true")).toBe(true));
  it("legacy charges without a method are still Pix", () => expect(methodOf({})).toBe("PIX"));
  it("explicit Pix charges stay Pix", () =>
    expect(methodOf({ payment_method: "PIX" })).toBe("PIX"));
  it("recognizes only explicit card method", () =>
    expect(methodOf({ payment_method: "CARD_NFC" })).toBe("CARD_NFC"));
  it("disabled create/read touch no authentication, limits, persistence or audit", async () => {
    const d = deps();
    expect((await cardApi(request(), undefined, d)).status).toBe(404);
    expect((await cardApi(request(), "false", d, id)).status).toBe(404);
    for (const fn of Object.values(d)) expect(fn).not.toHaveBeenCalled();
  });
  it("disabled webhook and reconcile return 404 without configured secrets or storage", async () => {
    vi.stubEnv("CARD_NFC_ENABLED", "false");
    expect((await cardWebhook(request())).status).toBe(404);
    expect((await cardReconcile(request())).status).toBe(404);
  });
  it("requires an API key before persistence", async () => {
    const d = deps();
    d.authenticate = vi.fn(async () => {
      throw new Error("Unauthorized: invalid API key");
    });
    expect((await cardApi(request(), "true", d)).status).toBe(401);
    expect(d.create).not.toHaveBeenCalled();
    expect(d.audit).toHaveBeenCalledWith(null, 401);
  });
  it("rate limit fails closed with Retry-After and no session", async () => {
    const d = deps();
    d.limit = vi.fn(async () => false);
    const response = await cardApi(request(), "true", d);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(d.create).not.toHaveBeenCalled();
  });
  it("missing storage returns 503, not a simulated success", async () => {
    const d = deps();
    d.create = vi.fn(async () => {
      throw new Error("Card storage unavailable");
    });
    expect((await cardApi(request(), "true", d)).status).toBe(503);
  });
  it("idempotency conflicts are 409", async () => {
    const d = deps();
    d.create = vi.fn(async () => {
      throw new CardConflict();
    });
    expect((await cardApi(request(), "true", d)).status).toBe(409);
  });
  it("requires idempotency key", async () => {
    const d = deps();
    const req = request();
    req.headers.delete("Idempotency-Key");
    expect((await cardApi(req, "true", d)).status).toBe(400);
    expect(d.create).not.toHaveBeenCalled();
  });
  it("tenant is taken only from authentication, not the request", async () => {
    const d = deps();
    expect(
      (
        await cardApi(
          request({ integrationId: integration, amountCents: 1500, accountId: id }),
          "true",
          d,
        )
      ).status,
    ).toBe(400);
    expect(d.create).not.toHaveBeenCalled();
    expect((await cardApi(request(), "true", d)).status).toBe(201);
    expect(d.create).toHaveBeenCalledWith(account, id, "request_1", {
      integrationId: integration,
      amountCents: 1500,
    });
  });
  it("read is scoped to the authenticated account", async () => {
    const d = deps();
    d.read = vi.fn(async () => null);
    expect((await cardApi(request(), "true", d, id)).status).toBe(404);
    expect(d.read).toHaveBeenCalledWith(account, id);
  });
  it("returns a minimized response with simulation true and no financial confirmation", async () => {
    const d = deps();
    const response = await cardApi(request(), "true", d);
    expect(await response.json()).toEqual(sessionResponse(session));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(d.audit).toHaveBeenCalledWith({ accountId: account, apiKeyId: id }, 201);
  });
  it("replayed reservation returns the same session", async () => {
    const d = deps();
    d.create = vi.fn(async () => ({ session, replay: true }));
    const response = await cardApi(request(), "true", d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sessionResponse(session));
  });
  it.each(["pan", "cardNumber", "cvv", "expiry", "track", "payer", "payload"])(
    "rejects unexpected sensitive field %s before persistence",
    async (field) => {
      const d = deps();
      expect(
        (
          await cardApi(
            request({ integrationId: integration, amountCents: 1500, [field]: "not-accepted" }),
            "true",
            d,
          )
        ).status,
      ).toBe(400);
      expect(d.create).not.toHaveBeenCalled();
    },
  );
  it("does not allow card-number-like free references", () =>
    expect(
      cardInput.safeParse({
        integrationId: integration,
        amountCents: 1500,
        externalReference: "order_4111111111111111",
      }).success,
    ).toBe(false));
  it("bounds chunked body without trusting Content-Length", async () =>
    await expect(
      boundedBody(new Request("http://localhost", { method: "POST", body: "x".repeat(4097) })),
    ).rejects.toThrow("Body too large"));
  it("canonical request hash is independent of key order", () => {
    expect(hashCardInput({ integrationId: integration, amountCents: 1500 })).toBe(
      hashCardInput({ amountCents: 1500, integrationId: integration }),
    );
    expect(hashCardInput({ integrationId: integration, amountCents: 1501 })).not.toBe(
      hashCardInput({ integrationId: integration, amountCents: 1500 }),
    );
  });
  it("MOCK creation never approves a payment", async () => {
    const s = await mockCardAdapter.createSession({ sessionId: id, amountCents: 1500 });
    expect(s).toEqual({
      providerSessionId: `mock_${id}`,
      amountCents: 1500,
      status: "AWAITING_CARD",
      simulation: true,
    });
    expect(await mockCardAdapter.getSession(s)).toEqual(s);
    expect((await mockCardAdapter.cancelSession(s)).status).toBe("CANCELED");
    await expect(mockCardAdapter.refund(s)).rejects.toThrow();
    expect((await mockCardAdapter.refund({ ...s, status: "APPROVED" })).status).toBe("REFUNDED");
  });
  it("terminal sessions and approvals cannot regress", () => {
    expect(canTransition("APPROVED", "AWAITING_CARD")).toBe(false);
    expect(canTransition("APPROVED", "REFUNDED")).toBe(true);
    expect(canTransition("CANCELED", "APPROVED")).toBe(false);
    expect(canTransition("EXPIRED", "APPROVED")).toBe(false);
    expect(canTransition("AWAITING_CARD", "REFUNDED")).toBe(false);
    expect(canTransition("AWAITING_CARD", "CREATED")).toBe(false);
  });
});

describe("Cryptographic webhook boundary", () => {
  const body = JSON.stringify({
    eventId: "evt_1",
    integrationId: integration,
    providerSessionId: `mock_${id}`,
    amountCents: 1500,
    status: "APPROVED",
  });
  const timestamp = "1795392000";
  const now = Number(timestamp) * 1000;
  const secret = "test-only-not-a-live-secret";
  const sign = (value: string) =>
    createHmac("sha256", secret).update(`${timestamp}.${value}`).digest("hex");
  it("verifies HMAC over timestamp and the exact raw body", () =>
    expect(verifyCardSignature(body, timestamp, sign(body), secret, now)).toBe(true));
  it("rejects altered bodies and malformed signatures", () => {
    expect(verifyCardSignature(body + " ", timestamp, sign(body), secret, now)).toBe(false);
    expect(verifyCardSignature(body, timestamp, "x", secret, now)).toBe(false);
    expect(verifyCardSignature(body, timestamp, sign(body), "", now)).toBe(false);
  });
  it("rejects replay beyond five minutes and future timestamps", () => {
    expect(verifyCardSignature(body, timestamp, sign(body), secret, now + 300001)).toBe(false);
    expect(verifyCardSignature(body, timestamp, sign(body), secret, now - 300001)).toBe(false);
  });
  it("does not persist or accept raw extra data even after signature verification", () => {
    expect(parseCardEvent(body)).toEqual(JSON.parse(body));
    expect(() => parseCardEvent(JSON.stringify({ ...JSON.parse(body), cvv: "123" }))).toThrow();
  });
});
