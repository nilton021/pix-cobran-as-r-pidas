import type { PaymentProviderId } from "@/lib/payment-providers";

/**
 * Identidade visual de cada instituição (cor oficial + sigla).
 * Usada só em elementos decorativos e de identificação — nunca no tema da interface.
 */
export type BankBrand = {
  name: string;
  color: string;
  /** Cor secundária para o gradiente da "bandeira". */
  colorTo: string;
  initials: string;
};

export const BANK_BRANDS: Record<PaymentProviderId, BankBrand> = {
  PICPAY: { name: "PicPay", color: "#21C25E", colorTo: "#0FA34A", initials: "PP" },
  ASAAS: { name: "Asaas", color: "#0B63F6", colorTo: "#0A47B8", initials: "AA" },
  INTER: { name: "Banco Inter", color: "#FF7A00", colorTo: "#E85D00", initials: "IN" },
  EFI: { name: "Efí Bank", color: "#00A6A0", colorTo: "#00807C", initials: "EF" },
  MERCADOPAGO: { name: "Mercado Pago", color: "#00B1C3", colorTo: "#0088A0", initials: "MP" },
  NUBANK: { name: "Nubank", color: "#820AD1", colorTo: "#5C0A96", initials: "NU" },
  ITAU: { name: "Itaú", color: "#FF7707", colorTo: "#D95F00", initials: "IT" },
  SANTANDER: { name: "Santander", color: "#EC0000", colorTo: "#B80000", initials: "SA" },
  BRADESCO: { name: "Bradesco", color: "#CC092F", colorTo: "#9A0623", initials: "BR" },
};

export type BankBrandId = PaymentProviderId;
