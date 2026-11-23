import { describe, expect, it } from "vitest";
import { canConfigureProvider } from "@/lib/payment-providers";

describe("Configuração de credenciais reais", () => {
  it("permite configurar PicPay", () => expect(canConfigureProvider("PICPAY")).toBe(true));
  it("permite configurar Banco Inter", () => expect(canConfigureProvider("INTER")).toBe(true));
  it("permite configurar Efí", () => expect(canConfigureProvider("EFI")).toBe(true));
  it("não libera configuração de provedores sem integração", () => expect(canConfigureProvider("NUBANK")).toBe(false));
});