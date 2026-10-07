export const PAYMENT_PROVIDERS = [
  { id: "PICPAY", name: "PicPay", status: "available" },
  { id: "ASAAS", name: "Asaas", status: "available" },
  { id: "INTER", name: "Banco Inter", status: "available" },
  { id: "EFI", name: "Efí Bank", status: "planned" },
  { id: "MERCADOPAGO", name: "Mercado Pago", status: "planned" },
  { id: "NUBANK", name: "Nubank", status: "planned" },
  { id: "ITAU", name: "Itaú", status: "planned" },
  { id: "SANTANDER", name: "Santander", status: "planned" },
  { id: "BRADESCO", name: "Bradesco", status: "planned" },
] as const;

export type PaymentProviderId = typeof PAYMENT_PROVIDERS[number]["id"];
