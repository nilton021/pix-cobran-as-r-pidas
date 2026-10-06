-- Secure PicPay integration management.
-- Keeps client credentials and webhook secret in Supabase Vault.
-- The caller must be authenticated and own the target account.

create or replace function public.save_picpay_integration(
  p_account_id uuid,
  p_integration_id uuid default null,
  p_display_name text default 'PicPay',
  p_environment text default 'PRODUCTION',
  p_client_id text default null,
  p_client_secret text default null,
  p_webhook_secret text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_integration_id uuid;
  v_existing_account_id uuid;
  v_secret_id uuid;
  v_secret_name text;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_account_id is null then
    raise exception 'Conta obrigatória';
  end if;

  if not exists (
    select 1
      from public.accounts a
     where a.id = p_account_id
       and a.owner_id = v_user_id
  ) then
    raise exception 'Conta não pertence ao usuário autenticado';
  end if;

  if p_environment not in ('SANDBOX', 'PRODUCTION') then
    raise exception 'Ambiente PicPay inválido';
  end if;

  if char_length(trim(coalesce(p_display_name, ''))) < 1
     or char_length(trim(p_display_name)) > 80 then
    raise exception 'Nome da integração deve ter entre 1 e 80 caracteres';
  end if;

  if p_integration_id is null then
    insert into public.payment_integrations (
      account_id,
      provider,
      environment,
      display_name,
      status
    )
    values (
      p_account_id,
      'PICPAY',
      p_environment,
      trim(p_display_name),
      'ACTIVE'
    )
    returning id into v_integration_id;
  else
    select pi.account_id
      into v_existing_account_id
      from public.payment_integrations pi
     where pi.id = p_integration_id
       and pi.provider = 'PICPAY';

    if v_existing_account_id is null then
      raise exception 'Integração PicPay não encontrada';
    end if;

    if v_existing_account_id <> p_account_id then
      raise exception 'Integração não pertence à conta informada';
    end if;

    v_integration_id := p_integration_id;

    update public.payment_integrations
       set environment = p_environment,
           display_name = trim(p_display_name),
           status = 'ACTIVE',
           updated_at = now()
     where id = v_integration_id;
  end if;

  -- Only one PicPay integration may be ACTIVE for an account because the
  -- charge flow intentionally requires exactly one active integration.
  update public.payment_integrations
     set status = 'INACTIVE',
         updated_at = now()
   where account_id = p_account_id
     and provider = 'PICPAY'
     and id <> v_integration_id
     and status = 'ACTIVE';

  -- A new integration must receive all three secrets. During an edit,
  -- blank values mean "keep the existing secret" so secrets never need
  -- to be read back into the browser.
  if p_integration_id is null
     and (
       nullif(trim(coalesce(p_client_id, '')), '') is null
       or nullif(trim(coalesce(p_client_secret, '')), '') is null
       or nullif(trim(coalesce(p_webhook_secret, '')), '') is null
     ) then
    raise exception 'Client ID, Client Secret e Webhook Token são obrigatórios no cadastro';
  end if;

  if nullif(trim(coalesce(p_client_id, '')), '') is not null then
    v_secret_name := 'pix_' || v_integration_id::text || '_client_id';
    select s.id into v_secret_id
      from vault.secrets s
     where s.name = v_secret_name
     limit 1;

    if v_secret_id is null then
      perform vault.create_secret(trim(p_client_id), v_secret_name, 'PicPay client_id da integração');
    else
      perform vault.update_secret(v_secret_id, trim(p_client_id));
    end if;
  end if;

  if nullif(trim(coalesce(p_client_secret, '')), '') is not null then
    v_secret_name := 'pix_' || v_integration_id::text || '_client_secret';
    select s.id into v_secret_id
      from vault.secrets s
     where s.name = v_secret_name
     limit 1;

    if v_secret_id is null then
      perform vault.create_secret(trim(p_client_secret), v_secret_name, 'PicPay client_secret da integração');
    else
      perform vault.update_secret(v_secret_id, trim(p_client_secret));
    end if;
  end if;

  if nullif(trim(coalesce(p_webhook_secret, '')), '') is not null then
    v_secret_name := 'pix_' || v_integration_id::text || '_webhook_secret';
    select s.id into v_secret_id
      from vault.secrets s
     where s.name = v_secret_name
     limit 1;

    if v_secret_id is null then
      perform vault.create_secret(trim(p_webhook_secret), v_secret_name, 'PicPay webhook secret da integração');
    else
      perform vault.update_secret(v_secret_id, trim(p_webhook_secret));
    end if;
  end if;

  -- Never activate an integration with an incomplete credential set.
  if not exists (
    select 1 from vault.secrets s
     where s.name = 'pix_' || v_integration_id::text || '_client_id'
  )
  or not exists (
    select 1 from vault.secrets s
     where s.name = 'pix_' || v_integration_id::text || '_client_secret'
  )
  or not exists (
    select 1 from vault.secrets s
     where s.name = 'pix_' || v_integration_id::text || '_webhook_secret'
  ) then
    raise exception 'Credenciais PicPay incompletas para a integração';
  end if;

  update public.payment_integrations
     set status = 'ACTIVE',
         updated_at = now()
   where id = v_integration_id;

  return v_integration_id;
end;
$$;

revoke all on function public.save_picpay_integration(
  uuid, uuid, text, text, text, text, text
) from public, anon;

grant execute on function public.save_picpay_integration(
  uuid, uuid, text, text, text, text, text
) to authenticated, service_role;

comment on function public.save_picpay_integration(
  uuid, uuid, text, text, text, text, text
) is
  'Creates or updates an owned PicPay integration and stores client credentials/webhook secret only in Supabase Vault. No secret is returned.';
