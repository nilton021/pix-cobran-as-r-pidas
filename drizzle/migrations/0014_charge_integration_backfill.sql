-- Fase 18: backfill seguro das cobranças legadas.
-- Vincula somente cobranças cujo account_id tenha exatamente uma integração PicPay ACTIVE.
-- Cobranças ambíguas ou sem integração permanecem intactas para tratamento manual.

create index if not exists charges_legacy_backfill_idx
  on public.charges(account_id, payment_integration_id)
  where payment_integration_id is null;

update public.charges c
set payment_integration_id = pi.id,
    updated_at = now()
from public.payment_integrations pi
where c.payment_integration_id is null
  and pi.account_id = c.account_id
  and pi.provider = 'PICPAY'
  and pi.status = 'ACTIVE'
  and not exists (
    select 1
    from public.payment_integrations pi2
    where pi2.account_id = c.account_id
      and pi2.provider = 'PICPAY'
      and pi2.status = 'ACTIVE'
      and pi2.id <> pi.id
  );

comment on index public.charges_legacy_backfill_idx is
  'Apoia a identificação de cobranças legadas ainda sem integração PicPay.';
