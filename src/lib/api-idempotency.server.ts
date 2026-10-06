import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type IdempotencyRecord = {
  api_key_id: string;
  idempotency_key: string;
  request_hash: string;
  charge_id: string | null;
  response_status: number | null;
  completed_at: string | null;
};

export type IdempotencyReservation =
  | { kind: "new"; requestHash: string }
  | { kind: "completed"; chargeId: string; responseStatus: number }
  | { kind: "processing" }
  | { kind: "conflict" };

export function hashIdempotencyPayload(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}

export async function reserveIdempotencyKey(
  apiKeyId: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<IdempotencyReservation> {
  const { error } = await supabaseAdmin.from("api_idempotency_keys").insert({
    api_key_id: apiKeyId,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
  });

  if (!error) return { kind: "new", requestHash };
  if (error.code !== "23505") throw error;

  const { data, error: readError } = await supabaseAdmin
    .from("api_idempotency_keys")
    .select("api_key_id, idempotency_key, request_hash, charge_id, response_status, completed_at")
    .eq("api_key_id", apiKeyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (readError || !data) throw readError ?? new Error("Chave de idempotência não encontrada");

  const record = data as IdempotencyRecord;
  if (record.request_hash !== requestHash) return { kind: "conflict" };
  if (record.charge_id && record.response_status) {
    return {
      kind: "completed",
      chargeId: record.charge_id,
      responseStatus: record.response_status,
    };
  }
  return { kind: "processing" };
}

export async function completeIdempotencyKey(
  apiKeyId: string,
  idempotencyKey: string,
  chargeId: string,
  responseStatus: number,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("api_idempotency_keys")
    .update({
      charge_id: chargeId,
      response_status: responseStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("api_key_id", apiKeyId)
    .eq("idempotency_key", idempotencyKey);

  if (error) throw error;
}

export async function releaseIdempotencyKey(apiKeyId: string, idempotencyKey: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("api_idempotency_keys")
    .delete()
    .eq("api_key_id", apiKeyId)
    .eq("idempotency_key", idempotencyKey);

  if (error) {
    console.error("[idempotency] falha ao liberar chave", {
      apiKeyId,
      idempotencyKey,
      error: error.message,
    });
  }
}
