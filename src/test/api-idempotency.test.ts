import { describe, expect, it } from "vitest";
import { hashIdempotencyPayload } from "@/lib/api-idempotency.server";

describe("API idempotency", () => {
  it("gera o mesmo hash para o mesmo payload", () => {
    const payload = {
      amountCents: 1500,
      description: "Pedido 123",
      expirationSeconds: 900,
    };

    expect(hashIdempotencyPayload(payload)).toBe(hashIdempotencyPayload(payload));
  });

  it("gera hashes diferentes para payloads diferentes", () => {
    expect(
      hashIdempotencyPayload({ amountCents: 1500 }),
    ).not.toBe(hashIdempotencyPayload({ amountCents: 1501 }));
  });

  it("gera hash SHA-256 hexadecimal", () => {
    expect(hashIdempotencyPayload({ amountCents: 1500 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
