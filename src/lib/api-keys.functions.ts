import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateApiKey } from "@/lib/api-keys.server";

const createSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: account, error: accountError } = await context.supabase
      .from("accounts")
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();

    if (accountError || !account) throw new Error("Conta não encontrada");

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new Error("A expiração da API key deve estar no futuro");
    }

    const generated = generateApiKey();
    const { data: apiKey, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        account_id: account.id,
        name: data.name,
        key_prefix: generated.keyPrefix,
        key_hash: generated.keyHash,
        expires_at: expiresAt?.toISOString() ?? null,
      })
      .select("id, account_id, name, key_prefix, expires_at, created_at")
      .single();

    if (error || !apiKey) {
      console.error("[api-key] falha ao criar", error?.message);
      throw new Error("Não foi possível criar a API key");
    }

    return { ...apiKey, key: generated.plaintext };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ apiKeyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("api_keys")
      .select("id")
      .eq("id", data.apiKeyId)
      .maybeSingle();

    if (!owned) throw new Error("API key não encontrada");

    const { data: revoked, error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.apiKeyId)
      .is("revoked_at", null)
      .select("id, account_id, name, key_prefix, expires_at, revoked_at, created_at")
      .single();

    if (error || !revoked) {
      throw new Error("Não foi possível revogar a API key");
    }

    return revoked;
  });

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: keys, error } = await context.supabase
      .from("api_keys")
      .select("id, account_id, name, key_prefix, last_used_at, expires_at, revoked_at, created_at")
      .eq("account_id", data.accountId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Não foi possível listar as API keys");
    return keys ?? [];
  });
