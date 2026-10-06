// Contrato de nomes dos secrets PicPay por integração.
// Este módulo NÃO lê nem grava secrets. A resolução protegida fica para a Fase 4.
// Nunca importe este arquivo em código cliente.
//
// Formato:
//   pix_<integration_id>_client_id
//   pix_<integration_id>_client_secret
//   pix_<integration_id>_webhook_secret

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PICPAY_VAULT_SECRET_SUFFIXES = {
  clientId: "client_id",
  clientSecret: "client_secret",
  webhookSecret: "webhook_secret",
} as const;

function assertIntegrationId(integrationId: string): string {
  if (!UUID_RE.test(integrationId)) {
    throw new Error("payment_integration_id inválido");
  }
  return integrationId.toLowerCase();
}

export function getPicPayVaultSecretNames(integrationId: string) {
  const id = assertIntegrationId(integrationId);
  return {
    clientId: `pix_${id}_client_id`,
    clientSecret: `pix_${id}_client_secret`,
    webhookSecret: `pix_${id}_webhook_secret`,
  } as const;
}
