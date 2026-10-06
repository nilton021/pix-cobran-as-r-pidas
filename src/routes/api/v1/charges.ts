import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createApiAuditContext, recordApiAudit } from "@/lib/api-audit.server";

const schema = z.object({
  amountCents: z.number().int().min(1),
  description: z.string().max(140).optional(),
  expirationSeconds: z.number().int().min(60).max(86400).default(900),
});

export const Route = createFileRoute("/api/v1/charges")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let reservationOwner: { apiKeyId: string; idempotencyKey: string } | null = null;

        try {
          const { authenticateApiKey } = await import("@/lib/api-key-auth.server");
          const auth = await authenticateApiKey(request);
          const input = schema.parse(await request.json());
          const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
          if (!idempotencyKey || idempotencyKey.length > 255) {
            return Response.json({ error: "Idempotency-Key obrigatório e deve ter até 255 caracteres" }, { status: 400 });
          }

          const {
            hashIdempotencyPayload,
            reserveIdempotencyKey,
            completeIdempotencyKey,
            releaseIdempotencyKey,
          } = await import("@/lib/api-idempotency.server");
          const requestHash = hashIdempotencyPayload(input);
          const reservation = await reserveIdempotencyKey(auth.apiKeyId, idempotencyKey, requestHash);

          if (reservation.kind === "conflict") {
            return Response.json(
              { error: "Idempotency-Key já foi usada com parâmetros diferentes" },
              { status: 409 },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (reservation.kind === "completed") {
            const { data: existingCharge } = await supabaseAdmin
              .from("charges")
              .select("id, amount_cents, description, status, qr_code, qr_code_base64, expires_at, created_at, updated_at")
              .eq("id", reservation.chargeId)
              .eq("account_id", auth.accountId)
              .maybeSingle();
            if (!existingCharge) return Response.json({ error: "Cobrança não encontrada" }, { status: 404 });
            return Response.json(existingCharge, { status: reservation.responseStatus });
          }

          if (reservation.kind === "new") {
            reservationOwner = { apiKeyId: auth.apiKeyId, idempotencyKey };
          }

          if (reservation.kind === "processing") {
            return Response.json(
              { error: "Cobrança com esta Idempotency-Key ainda está sendo processada" },
              { status: 409, headers: { "Retry-After": "2" } },
            );
          }

          const { consumeApiRateLimit, rateLimitResponse } = await import("@/lib/api-rate-limit.server");
            const rateLimit = await consumeApiRateLimit(auth.apiKeyId, "create_charge");
            const limited = rateLimitResponse(rateLimit);
            if (limited) {
              await releaseIdempotencyKey(auth.apiKeyId, idempotencyKey);
              return limited;
            }

          const { data: account } = await supabaseAdmin
            .from("accounts")
            .select("id, name, email, document, document_type")
            .eq("id", auth.accountId)
            .maybeSingle();

          if (!account) {
            await releaseIdempotencyKey(auth.apiKeyId, idempotencyKey);
            return Response.json({ error: "Conta não encontrada" }, { status: 404 });
          }

          const { data: integrations } = await supabaseAdmin
            .from("payment_integrations")
            .select("id")
            .eq("account_id", account.id)
            .eq("provider", "PICPAY")
            .eq("status", "ACTIVE");

          if (!integrations || integrations.length !== 1) {
            await releaseIdempotencyKey(auth.apiKeyId, idempotencyKey);
            return Response.json(
              { error: integrations?.length ? "É necessário manter exatamente uma integração PicPay ativa para esta conta." : "Nenhuma integração PicPay ativa configurada para esta conta." },
              { status: 409 },
            );
          }

          const integrationId = integrations[0].id;
          const { data: charge, error: insertError } = await supabaseAdmin
            .from("charges")
            .insert({
              account_id: account.id,
              payment_integration_id: integrationId,
              amount_cents: input.amountCents,
              description: input.description ?? null,
              status: "PENDING",
            })
            .select()
            .single();

          if (insertError || !charge) throw new Error("Não foi possível criar a cobrança");

          try {
            const { createPixCharge, PicPayError } = await import("@/lib/picpay.server");
            const res = await createPixCharge(integrationId, {
              merchantChargeId: charge.id,
              customer: {
                name: account.name,
                email: account.email,
                documentType: account.document_type as "CPF" | "CNPJ",
                document: account.document,
              },
              amountCents: input.amountCents,
              expirationSeconds: input.expirationSeconds,
            });
            const pix = res.transactions?.[0]?.pix;
            const { data: updated, error } = await supabaseAdmin
              .from("charges")
              .update({
                picpay_charge_id: res.id ?? null,
                qr_code: pix?.qrCode ?? null,
                qr_code_base64: pix?.qrCodeBase64 ?? null,
                expires_at: new Date(Date.now() + input.expirationSeconds * 1000).toISOString(),
              })
              .eq("id", charge.id)
              .select("id, amount_cents, description, status, qr_code, qr_code_base64, expires_at, created_at, updated_at")
              .single();
            if (error || !updated) throw new Error("Não foi possível finalizar a cobrança");
            await completeIdempotencyKey(auth.apiKeyId, idempotencyKey, charge.id, 201);
            await recordApiAudit(audit, { route: "/api/v1/charges", method: "POST", statusCode: 201, eventType: "charge_created" });\n            return Response.json(updated, { status: 201 });
          } catch (error) {
            await releaseIdempotencyKey(auth.apiKeyId, idempotencyKey);
            const msg = error instanceof PicPayError ? `${error.message}: ${error.body.slice(0, 300)}` : (error as Error).message;
            await supabaseAdmin.from("charges").update({ status: "ERROR", last_error: msg }).eq("id", charge.id);
            console.error("[api/v1/charges] falha", charge.id, msg);
            await recordApiAudit(audit, { route: "/api/v1/charges", method: "POST", statusCode: 502, eventType: "provider_error" });\n            return Response.json({ error: "Não foi possível gerar o Pix no PicPay." }, { status: 502 });
          }
        } catch (error) {
          if (reservationOwner) {
            const { releaseIdempotencyKey } = await import("@/lib/api-idempotency.server");
            await releaseIdempotencyKey(reservationOwner.apiKeyId, reservationOwner.idempotencyKey);
          }
          if (error instanceof z.ZodError) return Response.json({ error: "Dados inválidos", details: error.flatten() }, { status: 400 });
          const message = error instanceof Error ? error.message : "Unauthorized";
          if (message === "Rate limit indisponível") {\n            await recordApiAudit(audit, { route: "/api/v1/charges", method: "POST", statusCode: 503, eventType: "dependency_error" });\n            return Response.json({ error: "Serviço temporariamente indisponível" }, { status: 503 });\n          }
          if (message.startsWith("Unauthorized:")) {\n            await recordApiAudit(audit, { route: "/api/v1/charges", method: "POST", statusCode: 401, eventType: "authentication_failure" });\n            return Response.json({ error: "Não autorizado" }, { status: 401 });\n          }
          await recordApiAudit(audit, { route: "/api/v1/charges", method: "POST", statusCode: 500, eventType: "server_error" });\n          return Response.json({ error: "Não foi possível criar a cobrança" }, { status: 500 });
        }
      },
    },
  },
});
