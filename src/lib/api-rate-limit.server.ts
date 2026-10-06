import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const LIMITS = {
  createCharge: 10,
  readCharge: 60,
} as const;

export async function consumeApiRateLimit(
  apiKeyId: string,
  route: "create_charge" | "read_charge",
): Promise<RateLimitResult> {
  const limit = route === "create_charge" ? LIMITS.createCharge : LIMITS.readCharge;
  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
    p_api_key_id: apiKeyId,
    p_route: route,
    p_limit: limit,
    p_window_seconds: 60,
  });

  if (error || !data?.[0]) {
    console.error("[rate-limit] falha ao consumir limite", {
      apiKeyId,
      route,
      error: error?.message,
    });
    throw new Error("Rate limit indisponível");
  }

  return {
    allowed: Boolean(data[0].allowed),
    remaining: Number(data[0].remaining),
    retryAfterSeconds: Number(data[0].retry_after_seconds),
  };
}

export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.allowed) return null;

  return Response.json(
    { error: "Limite de requisições excedido" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}
