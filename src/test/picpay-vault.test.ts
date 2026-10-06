import { describe, expect, it } from "vitest";
import { getPicPayVaultSecretNames } from "@/lib/picpay-vault.server";

describe("PicPay Vault secret naming", () => {
  it("gera nomes determinísticos por payment_integration_id", () => {
    const names = getPicPayVaultSecretNames("550E8400-E29B-41D4-A716-446655440000");

    expect(names).toEqual({
      clientId: "pix_550e8400-e29b-41d4-a716-446655440000_client_id",
      clientSecret: "pix_550e8400-e29b-41d4-a716-446655440000_client_secret",
      webhookSecret: "pix_550e8400-e29b-41d4-a716-446655440000_webhook_secret",
    });
  });

  it("rejeita identificador que não seja UUID", () => {
    expect(() => getPicPayVaultSecretNames("not-a-uuid")).toThrow(
      "payment_integration_id inválido",
    );
  });
});
