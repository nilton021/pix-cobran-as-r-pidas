import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cardEventSchema, isCardEnabled, type CardInput } from "./contracts";
export function cardUnavailable(value: string | undefined): Response | null {
  return isCardEnabled(value) ? null : new Response(null, { status: 404 });
}
export function requireCardEnabled(): void {
  if (!isCardEnabled(process.env["CARD_NFC_ENABLED"]))
    throw new Error("Cartão por aproximação desativado");
}
export function hashCardInput(input: CardInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        integrationId: input.integrationId,
        amountCents: input.amountCents,
        externalReference: input.externalReference ?? null,
        deviceId: input.deviceId ?? null,
      }),
    )
    .digest("hex");
}
export function safeSecret(provided: string, expected: string): boolean {
  return (
    Boolean(expected) &&
    timingSafeEqual(
      createHash("sha256").update(provided).digest(),
      createHash("sha256").update(expected).digest(),
    )
  );
}
export function verifyCardSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (
    Buffer.byteLength(body) > 4096 ||
    !secret ||
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  if (Math.abs(now - Number(timestamp) * 1000) > 300000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
export function parseCardEvent(body: string) {
  return cardEventSchema.parse(JSON.parse(body));
}
// Leitura limitada inclusive para requisições chunked (Content-Length não é confiável).
export async function boundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
