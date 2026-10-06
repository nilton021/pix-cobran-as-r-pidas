import { describe, expect, it } from "vitest";
import { createApiAuditContext } from "@/lib/api-audit.server";

describe("API audit", () => {
  it("reutiliza X-Request-Id quando fornecido", () => {
    const context = createApiAuditContext(new Request("https://example.test", {
      headers: { "x-request-id": "req-123" },
    }));
    expect(context.requestId).toBe("req-123");
  });

  it("gera request id quando o header não existe", () => {
    const context = createApiAuditContext(new Request("https://example.test"));
    expect(context.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
