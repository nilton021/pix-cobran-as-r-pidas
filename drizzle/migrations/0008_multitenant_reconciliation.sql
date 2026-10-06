-- Fase 11: otimizar a reconciliação multi-tenant.
-- A rotina consulta somente cobranças que já possuem integração vinculada.
-- Cobranças legadas sem payment_integration_id ficam para o backfill da Fase 18.

create index if not exists charges_reconciliation_idx
  on public.charges(status, created_at, payment_integration_id)
  where status = 'PENDING' and payment_integration_id is not null;
