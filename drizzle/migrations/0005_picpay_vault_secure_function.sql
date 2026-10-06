-- Fase 4: acesso protegido às credenciais PicPay no Supabase Vault.
-- A função é SECURITY DEFINER, não é um getter genérico de secrets e só pode
-- ser executada pelo contexto lógico service_role do Supabase.
--
-- Os nomes dos secrets seguem o contrato da Fase 3:
-- pix_<integration_id>_client_id
-- pix_<integration_id>_client_secret
-- pix_<integration_id>_webhook_secret

create or replace function public.get_picpay_integration_credentials(
  p_integration_id uuid
)
returns table (
  integration_id uuid,
  environment text,
  client_id text,
  client_secret text,
  webhook_secret text
)
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  integration_provider text;
  integration_status text;
  v_environment text;
  v_client_id text;
  v_client_secret text;
  v_webhook_secret text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Acesso não autorizado';
  end if;

  select pi.provider, pi.status
    into integration_provider, integration_status
    from public.payment_integrations pi
   where pi.id = p_integration_id;

  if not found then
    raise exception 'Integração de pagamento não encontrada';
  end if;

  if integration_provider <> 'PICPAY' or integration_status <> 'ACTIVE' then
    raise exception 'Integração PicPay não está ativa';
  end if;

  select
    pi.environment,
    max(ds.decrypted_secret) filter (
      where ds.name = 'pix_' || p_integration_id::text || '_client_id'
    ),
    max(ds.decrypted_secret) filter (
      where ds.name = 'pix_' || p_integration_id::text || '_client_secret'
    ),
    max(ds.decrypted_secret) filter (
      where ds.name = 'pix_' || p_integration_id::text || '_webhook_secret'
    )
    into v_environment, v_client_id, v_client_secret, v_webhook_secret
  from public.payment_integrations pi
  left join vault.decrypted_secrets ds
    on ds.name in (
      'pix_' || p_integration_id::text || '_client_id',
      'pix_' || p_integration_id::text || '_client_secret',
      'pix_' || p_integration_id::text || '_webhook_secret'
    )
  where pi.id = p_integration_id
  group by pi.environment;

  if v_client_id is null or v_client_secret is null or v_webhook_secret is null then
    raise exception 'Credenciais PicPay não configuradas para a integração';
  end if;

  return query
  select p_integration_id, v_environment, v_client_id, v_client_secret, v_webhook_secret;
end;
$$;

revoke all on function public.get_picpay_integration_credentials(uuid)
  from public, anon, authenticated;

grant execute on function public.get_picpay_integration_credentials(uuid)
  to service_role;

comment on function public.get_picpay_integration_credentials(uuid) is
  'Resolve somente as três credenciais PicPay da integração informada; execução restrita ao service_role.';
