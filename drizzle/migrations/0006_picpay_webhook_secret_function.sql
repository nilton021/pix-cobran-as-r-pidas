-- Fase 9: segredo de webhook PicPay por integração.
-- Não expõe client_id/client_secret e não é um getter genérico do Vault.

create or replace function public.get_picpay_webhook_secret(
  p_integration_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  integration_provider text;
  integration_status text;
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

  select ds.decrypted_secret
    into v_webhook_secret
    from vault.decrypted_secrets ds
   where ds.name = 'pix_' || p_integration_id::text || '_webhook_secret'
   limit 1;

  if v_webhook_secret is null then
    raise exception 'Webhook secret PicPay não configurado para a integração';
  end if;

  return v_webhook_secret;
end;
$$;

revoke all on function public.get_picpay_webhook_secret(uuid)
  from public, anon, authenticated;

grant execute on function public.get_picpay_webhook_secret(uuid)
  to service_role;

comment on function public.get_picpay_webhook_secret(uuid) is
  'Resolve somente o webhook_secret da integração PicPay informada; execução restrita ao service_role.';
