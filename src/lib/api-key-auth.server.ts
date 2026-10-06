import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashApiKey } from "@/lib/api-keys.server";

export type ApiKeyAuthContext = {
  apiKeyId: string;
  accountId: string;
};

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("Unauthorized: API key required");
  const token = header.slice(7).trim();
  if (!token) throw new Error("Unauthorized: API key required");
  return token;
}

export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthContext> {
  const token = getBearerToken(request);
  const keyHash = hashApiKey(token);

  const { data: key, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, account_id, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !key) throw new Error("Unauthorized: invalid API key");
  if (key.revoked_at) throw new Error("Unauthorized: API key revoked");
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    throw new Error("Unauthorized: API key expired");
  }

  const { error: updateError } = await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  if (updateError) {
    console.error("[api-key] falha ao atualizar last_used_at", key.id, updateError.message);
  }

  return { apiKeyId: key.id, accountId: key.account_id };
}

export const authenticateCurrentApiKey = createServerFn({ method: "GET" })
  .handler(async () => {
    const request = getRequest();
    return authenticateApiKey(request);
  });

export const apiKeyAuthSchema = z.object({
  accountId: z.string().uuid(),
});
