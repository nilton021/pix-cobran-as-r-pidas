import { describe, expect, it } from "vitest";
import { authSchema } from "@/routes/login";

describe("auth onboarding contract", () => {
  it("rejects passwords shorter than 12 characters", () => {
    const result = authSchema.safeParse({ fullName: "Cliente", email: "cliente@example.com", password: "curta" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid signup payload", () => {
    const result = authSchema.safeParse({ fullName: "Cliente", email: "cliente@example.com", password: "senha-segura-12" });
    expect(result.success).toBe(true);
  });
});
