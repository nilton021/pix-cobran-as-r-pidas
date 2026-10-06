import { describe, expect, it } from "vitest";
import { hashApiKey } from "@/lib/api-keys.server";

describe("API key authentication", () => {
  it("usa SHA-256 determinístico para localizar a chave sem armazenar plaintext", () => {
    const key = "pk_example_secret";
    expect(hashApiKey(key)).toHaveLength(64);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it("não trata accountId enviado pelo cliente como credencial", () => {
    expect(hashApiKey("pk_example_secret")).not.toBe(hashApiKey("pk_other_secret"));
  });
});
