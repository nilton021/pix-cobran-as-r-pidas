import type { CardStatus } from "./contracts";
export type SessionSnapshot = { providerSessionId: string; amountCents: number; status: CardStatus; simulation: true };
export interface CardPresentAdapter {
  createSession(input: { sessionId: string; amountCents: number }): Promise<SessionSnapshot>;
  getSession(snapshot: SessionSnapshot): Promise<SessionSnapshot>;
  cancelSession(snapshot: SessionSnapshot): Promise<SessionSnapshot>;
  refund(snapshot: SessionSnapshot): Promise<SessionSnapshot>;
}
// Sem I/O externo, sem cache global e sem processamento de pagamentos reais.
export const mockCardAdapter: CardPresentAdapter = {
  async createSession(input) { return { providerSessionId: `mock_${input.sessionId}`, amountCents: input.amountCents, status: "AWAITING_CARD", simulation: true }; },
  async getSession(snapshot) { return { ...snapshot, simulation: true }; },
  async cancelSession(snapshot) {
    if (!["CREATED", "AWAITING_CARD", "CANCELED"].includes(snapshot.status)) throw new Error("Sessão não pode ser cancelada");
    return { ...snapshot, status: "CANCELED", simulation: true };
  },
  async refund(snapshot) {
    if (!["APPROVED", "REFUNDED"].includes(snapshot.status)) throw new Error("Sessão não pode ser estornada");
    return { ...snapshot, status: "REFUNDED", simulation: true };
  },
};
