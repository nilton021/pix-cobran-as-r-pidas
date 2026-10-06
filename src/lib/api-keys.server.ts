import { createHash, randomBytes } from "node:crypto";

export type GeneratedApiKey = {
  plaintext: string;
  keyPrefix: string;
  keyHash: string;
};

export function generateApiKey(): GeneratedApiKey {
  const plaintext = `pk_${randomBytes(32).toString("base64url")}`;
  const keyPrefix = plaintext.slice(0, 14);
  const keyHash = hashApiKey(plaintext);
  return { plaintext, keyPrefix, keyHash };
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}
