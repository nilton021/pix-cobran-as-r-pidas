-- Multi-provider payment foundation: keep existing PicPay and add Asaas now.
-- Other providers are reserved in the provider registry for subsequent adapters.
alter table public.payment_integrations
  drop constraint if exists payment_integrations_provider_check;

alter table public.payment_integrations
  add constraint payment_integrations_provider_check
  check (provider in ('PICPAY', 'ASAAS', 'INTER', 'EFI', 'MERCADOPAGO', 'NUBANK', 'ITAU', 'SANTANDER', 'BRADESCO'));

alter table public.charges
  add column if not exists provider_charge_id text;

create index if not exists charges_provider_charge_idx
  on public.charges(payment_integration_id, provider_charge_id);

create unique index if not exists webhook_events_event_id_unique_idx
  on public.webhook_events(event_id)
  where event_id is not null;

create or replace function public.save_asaas_integration(
  p_account_id uuid,
  p_integration_id uuid default null,
  p_display_name text default 'Asaas',
  p_environment text default 'PRODUCTION',
  p_api_key text default null,
  p_webhook_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_integration_id uuid;
  v_existing_account_id uuid;
  v_secret_id uuid;
  v_secret_name text;
begin
  if v_user_id is null then raise exception 'Usuário não autenticado'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.owner_id = v_user_id
  ) then
    raise exception 'Conta não pertence ao usuário autenticado';
  end if;

  if p_environment not in ('SANDBOX', 'PRODUCTION') then
    raise exception 'Ambiente Asaas inválido';
  end if;

  if char_length(trim(coalesce(p_display_name, ''))) < 1
     or char_length(trim(p_display_name)) > 80 then
    raise exception 'Nome da integração deve ter entre 1 e 80 caracteres';
  end if;

  if p_integration_id is null then
    if nullif(trim(coalesce(p_api_key, '')), '') is null
       or nullif(trim(coalesce(p_webhook_token, '')), '') is null then
      raise exception 'API Key e token do Webhook Asaas são obrigatórios no cadastro';
    end if;

    insert into public.payment_integrations(account_id, provider, environment, display_name, status)
    values (p_account_id, 'ASAAS', p_environment, trim(p_display_name), 'ACTIVE')
    returning id into v_integration_id;
  else
    select pi.account_id into v_existing_account_id
      from public.payment_integrations pi
     where pi.id = p_integration_id and pi.provider = 'ASAAS';

    if v_existing_account_id is null then raise exception 'Integração Asaas não encontrada'; end if;
    if v_existing_account_id <> p_account_id then raise exception 'Integração não pertence à conta informada'; end if;

    v_integration_id := p_integration_id;

    update public.payment_integrations
       set environment = p_environment,
           display_name = trim(p_display_name),
           status = 'ACTIVE',
           updated_at = now()
     where id = v_integration_id;
  end if;

  update public.payment_integrations
     set status = 'INACTIVE', updated_at = now()
   where account_id = p_account_id
     and provider = 'ASAAS'
     and id <> v_integration_id
     and status = 'ACTIVE';

  if nullif(trim(coalesce(p_api_key, '')), '') is not null then
    v_secret_name := 'pix_' || v_integration_id::text || '_api_key';
    select s.id into v_secret_id from vault.secrets s where s.name = v_secret_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(trim(p_api_key), v_secret_name, 'Asaas API Key da integração');
    else
      perform vault.update_secret(v_secret_id, trim(p_api_key));
    end if;
  end if;

  if nullif(trim(coalesce(p_webhook_token, '')), '') is not null then
    v_secret_name := 'pix_' || v_integration_id::text || '_webhook_secret';
    select s.id into v_secret_id from vault.secrets s where s.name = v_secret_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(trim(p_webhook_token), v_secret_name, 'Asaas webhook authToken da integração');
    else
      perform vault.update_secret(v_secret_id, trim(p_webhook_token));
    end if;
  end if;

  if not exists (
    select 1 from vault.secrets s
    where s.name = 'pix_' || v_integration_id::text || '_api_key'
  ) or not exists (
    select 1 from vault.secrets s
    where s.name = 'pix_' || v_integration_id::text || '_webhook_secret'
  ) then
    raise exception 'Credenciais Asaas incompletas para a integração';
  end if;

  update public.payment_integrations
     set status = 'ACTIVE', updated_at = now()
   where id = v_integration_id;

  return v_integration_id;
end;
$$;

revoke all on function public.save_asaas_integration(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.save_asaas_integration(uuid, uuid, text, text, text, text) to authenticated, service_role;

create or replace function public.get_asaas_integration_credentials(p_integration_id uuid)
returns table(integration_id uuid, environment text, api_key text, webhook_secret text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Acesso restrito ao service_role';
  end if;

  return query
  select pi.id,
         pi.environment,
         (select s.decrypted_secret from vault.decrypted_secrets s
           where s.name = 'pix_' || pi.id::text || '_api_key' limit 1),
         (select s.decrypted_secret from vault.decrypted_secrets s
           where s.name = 'pix_' || pi.id::text || '_webhook_secret' limit 1)
    from public.payment_integrations pi
   where pi.id = p_integration_id
     and pi.provider = 'ASAAS'
     and pi.status = 'ACTIVE';
end;
$$;

revoke all on function public.get_asaas_integration_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_asaas_integration_credentials(uuid) to service_role;
