import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/api-keys.server";

describe("API key security", () => {
  it("gera uma chave forte e armazena apenas prefixo/hash", () => {
    const generated = generateApiKey();

    expect(generated.plaintext).toMatch(/^pk_[A-Za-z0-9_-]{43}$/);
    expect(generated.keyPrefix).toBe(generated.plaintext.slice(0, 14));
    expect(generated.keyHash).toHaveLength(64);
    expect(generated.keyHash).toBe(hashApiKey(generated.plaintext));
    expect(generated.keyHash).not.toContain(generated.plaintext);
  });

  it("gera chaves diferentes", () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
  });
});
