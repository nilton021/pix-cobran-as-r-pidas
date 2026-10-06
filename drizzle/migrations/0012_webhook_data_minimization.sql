-- Fase 16: minimizar dados de webhook e aplicar retenção automática.
-- O payload completo do PicPay não é persistido.

alter table public.webhook_events
  add column if not exists payload_hash text;

alter table public.webhook_events
  drop column if exists payload;

alter table public.webhook_events
  add constraint webhook_events_payload_hash_length
  check (payload_hash is null or length(payload_hash) = 64);

create index if not exists webhook_events_received_idx
  on public.webhook_events(received_at desc);

create index if not exists webhook_events_merchant_received_idx
  on public.webhook_events(merchant_charge_id, received_at desc);

create or replace function public.purge_old_webhook_events(p_retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Acesso não autorizado';
  end if;
  if p_retention_days < 1 or p_retention_days > 3650 then
    raise exception 'Período de retenção inválido';
  end if;

  delete from public.webhook_events
  where received_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_old_webhook_events(integer) from public, anon, authenticated;
grant execute on function public.purge_old_webhook_events(integer) to service_role;

comment on function public.purge_old_webhook_events(integer) is
  'Remove eventos de webhook antigos; execução restrita ao service_role.';

-- Retenção diária. Não substitui a reconciliação de cobranças.
select cron.unschedule(jobid)
from cron.job
where jobname = 'pix-webhook-retention';

select cron.schedule(
  'pix-webhook-retention',
  '15 3 * * *',
  $$select public.purge_old_webhook_events(30);$$
);
