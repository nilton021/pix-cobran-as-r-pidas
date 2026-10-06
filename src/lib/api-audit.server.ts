import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ApiAuditContext = {
  requestId: string;
  startedAt: number;
  accountId?: string;
  apiKeyId?: string;
};

export function createApiAuditContext(request: Request): ApiAuditContext {
  return {
    requestId: request.headers.get("x-request-id")?.trim() || randomUUID(),
    startedAt: Date.now(),
  };
}

export async function recordApiAudit(
  context: ApiAuditContext,
  input: {
    route: string;
    method: string;
    statusCode: number;
    eventType?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabaseAdmin.from("api_audit_events").insert({
    account_id: context.accountId ?? null,
    api_key_id: context.apiKeyId ?? null,
    request_id: context.requestId,
    route: input.route,
    method: input.method,
    status_code: input.statusCode,
    duration_ms: Math.max(0, Date.now() - context.startedAt),
    event_type: input.eventType ?? "api_request",
    metadata: input.metadata ?? {},
  });

  if (error) console.error("[api-audit] falha ao registrar evento", error.message);
}
