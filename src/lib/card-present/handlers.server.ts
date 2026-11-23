import { createHash } from "node:crypto";
import { z } from "zod";
import { cardInput, sessionResponse, type CardInput, type CardSession } from "./contracts";
import { boundedBody, cardUnavailable, parseCardEvent, safeSecret, verifyCardSignature } from "./security.server";
import { CardConflict, consumeCardLimit, createCardSession, enqueueCardEvent, readCardSession, reconcileCardSessions } from "./repository.server";

type Actor = { accountId: string; apiKeyId: string };
export type CardApiDependencies = {
  authenticate: (request: Request) => Promise<Actor>;
  limit: (accountId: string, actorId: string) => Promise<boolean>;
  create: (accountId: string, actorId: string, key: string, input: CardInput) => Promise<{ session: CardSession; replay: boolean }>;
  read: (accountId: string, id: string) => Promise<CardSession | null>;
  audit: (actor: Actor | null, status: number) => Promise<void>;
};
function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
async function dependencies(request: Request): Promise<CardApiDependencies> {
  const { authenticateApiKey } = await import("@/lib/api-key-auth.server");
  const { createApiAuditContext, recordApiAudit } = await import("@/lib/api-audit.server");
  const audit = createApiAuditContext(request);
  // Ignora identificadores fornecidos pelo chamador; não são registrados textos livres.
  audit.requestId = crypto.randomUUID();
  return { authenticate: authenticateApiKey, limit: consumeCardLimit, create: createCardSession, read: readCardSession,
    audit: async (actor, status) => {
      if (actor) { audit.accountId = actor.accountId; audit.apiKeyId = actor.apiKeyId; }
      await recordApiAudit(audit, { route: new URL(request.url).pathname, method: request.method, statusCode: status,
        eventType: "card_nfc_sandbox", metadata: { simulation: true } });
    } };
}
export async function cardApi(request: Request, enabled: string | undefined, deps?: CardApiDependencies, id?: string): Promise<Response> {
  const blocked = cardUnavailable(enabled); if (blocked) return blocked;
  const d = deps ?? await dependencies(request); let actor: Actor | null = null; let response: Response;
  try {
    actor = await d.authenticate(request);
    if (!await d.limit(actor.accountId, actor.apiKeyId)) response = json({ error: "Limite de requisições excedido" }, 429, { "Retry-After": "60" });
    else if (id) {
      const session = await d.read(actor.accountId, z.string().uuid().parse(id));
      response = session ? json(sessionResponse(session), 200) : json({ error: "Sessão não encontrada" }, 404);
    } else {
      const key = z.string().min(1).max(255).regex(/^[A-Za-z0-9_-]+$/).parse(request.headers.get("Idempotency-Key"));
      const input = cardInput.parse(JSON.parse(await boundedBody(request)));
      const result = await d.create(actor.accountId, actor.apiKeyId, key, input);
      response = json(sessionResponse(result.session), result.replay ? 200 : 201);
    }
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError || (error instanceof Error && error.message === "Body too large")) response = json({ error: "Dados inválidos; envie somente IDs de sessão, referências e valores" }, 400);
    else if (error instanceof Error && error.message.startsWith("Unauthorized:")) response = json({ error: "Não autorizado" }, 401);
    else if (error instanceof CardConflict) response = json({ error: "Chave ou referência já usada com parâmetros diferentes" }, 409);
    else response = json({ error: "Sandbox indisponível; nenhuma operação real de cartão realizada" }, 503);
  }
  await d.audit(actor, response.status);
  return response;
}
export async function cardWebhook(request: Request): Promise<Response> {
  const blocked = cardUnavailable(process.env["CARD_NFC_ENABLED"]); if (blocked) return blocked;
  try {
    const body = await boundedBody(request);
    const timestamp = request.headers.get("x-card-timestamp") ?? "";
    if (!verifyCardSignature(body, timestamp, request.headers.get("x-card-signature") ?? "", process.env["CARD_NFC_WEBHOOK_SECRET"] ?? "")) return json({ error: "Não autorizado" }, 401);
    const event = parseCardEvent(body);
    const accepted = await enqueueCardEvent(event, Number(timestamp), createHash("sha256").update(body).digest("hex"));
    return json({ accepted, simulation: true }, accepted ? 202 : 409);
  } catch { return json({ error: "Evento recusado ou armazenamento indisponível" }, 400); }
}
export async function cardReconcile(request: Request): Promise<Response> {
  const blocked = cardUnavailable(process.env["CARD_NFC_ENABLED"]); if (blocked) return blocked;
  if (!safeSecret(request.headers.get("x-card-cron-secret") ?? "", process.env["CARD_NFC_RECONCILE_SECRET"] ?? "")) return json({ error: "Não autorizado" }, 401);
  try { return json({ ...await reconcileCardSessions(), simulation: true }, 200); }
  catch { return json({ error: "Reconciliação sandbox indisponível" }, 503); }
}
