import { describe, expect, it } from "vitest";
import { rateLimitResponse } from "@/lib/api-rate-limit.server";

describe("API rate limit", () => {
  it("não bloqueia requisição dentro do limite", () => {
    expect(
      rateLimitResponse({
        allowed: true,
        remaining: 9,
        retryAfterSeconds: 42,
      }),
    ).toBeNull();
  });

  it("retorna 429 e Retry-After quando o limite é excedido", async () => {
    const response = rateLimitResponse({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 17,
    });

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("17");
    await expect(response?.json()).resolves.toEqual({
      error: "Limite de requisições excedido",
    });
  });
});
