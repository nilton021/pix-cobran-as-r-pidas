import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  reason: z.string().trim().min(3).max(500),
  customerName: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(80).optional(),
  amountCents: z.number().int().min(0).optional(),
});

/** Gera uma descrição Pix curta (até 140 caracteres) a partir do motivo informado. */
export const generatePixDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<{ description: string | null; error: string | null }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { description: null, error: "Recurso de IA não configurado." };

    const valor = data.amountCents ? (data.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "não informado";
    const prompt = [
      "Escreva a descrição de uma cobrança Pix que o cliente verá no app do banco.",
      "Regras: português do Brasil, tom cordial e profissional, no máximo 120 caracteres, sem emojis, sem aspas,",
      "sem dados sensíveis (CPF, CNPJ, senhas), sem inventar informações. Responda somente com a descrição.",
      `Motivo: ${data.reason}`,
      `Cliente: ${data.customerName || "não informado"}`,
      `Referência: ${data.reference || "não informada"}`,
      `Valor: ${valor}`,
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", input: prompt, stream: true, store: false, reasoning: { effort: "low" } }),
    });
    if (!res.ok || !res.body) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      if (res.status === 429) return { description: null, error: "Muitas solicitações agora. Tente novamente em instantes." };
      if (res.status === 402 || res.status === 403) return { description: null, error: "Créditos de IA esgotados ou recurso bloqueado no workspace." };
      return { description: null, error: "Não foi possível gerar a descrição agora." };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    let refused = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
          if (ev.type === "response.refusal.delta") refused = true;
        } catch { /* frame parcial */ }
      }
    }
    const description = text.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim().slice(0, 140);
    if (refused || !description) return { description: null, error: "A IA não gerou uma descrição para esse motivo." };
    return { description, error: null };
  });
