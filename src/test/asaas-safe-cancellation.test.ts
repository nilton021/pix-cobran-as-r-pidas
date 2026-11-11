import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Asaas safe cancellation contract", () => {
  it("checks the remote state before deleting and confirms the result", () => {
    const asaas = readRepoFile("src/lib/asaas.server.ts");
    expect(asaas).toContain('method: "DELETE"');
    expect(asaas).toContain('result.deleted === true');
    expect(asaas).toContain('result.id !== paymentId');
    expect(asaas).toContain('getPayment(id, paymentId)');
    expect(asaas).toContain('current.status === "DELETED"');
    expect(asaas).toContain('throw new Error("O Asaas não confirmou o cancelamento da cobrança")');
  });

  it("requires authenticated ownership and limits cancellation to pending Asaas charges", () => {
    const action = readRepoFile("src/lib/asaas-cancellation.functions.ts");
    expect(action).toContain("middleware([requireSupabaseAuth])");
    expect(action).toContain('.from("charges")');
    expect(action).toContain('charge.status !== "PENDING"');
    expect(action).toContain('integration?.provider !== "ASAAS"');
    expect(action).toContain('.eq("status", "PENDING")');
  });

  it("never marks a charge canceled before remote confirmation and protects paid races", () => {
    const action = readRepoFile("src/lib/asaas-cancellation.functions.ts");
    expect(action.indexOf('await cancelPayment(')).toBeLessThan(action.indexOf('status: "CANCELED"'));
    expect(action).toContain('if (outcome === "PAID")');
    expect(action).toContain('status: "PAID"');
    expect(action).toContain('Math.round(Number(remote.value) * 100) !== charge.amount_cents');
    expect(action).toContain('.eq("status", "PENDING")');
  });

  it("does not modify the existing provider creation or sync implementation", () => {
    const charges = readRepoFile("src/lib/charges.functions.ts");
    expect(charges).toContain('provider === "PICPAY"');
    expect(charges).toContain('provider === "ASAAS"');
    expect(charges).toContain('provider === "INTER"');
    expect(charges).toContain('provider === "EFI"');
    expect(charges).toContain("export const syncCharge");
  });
});
