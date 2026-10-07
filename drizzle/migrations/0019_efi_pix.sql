-- Efí Bank API Pix: OAuth2 + mTLS certificate and webhook HMAC protected in Vault.
create or replace function public.save_efi_integration(
  p_account_id uuid,
  p_integration_id uuid default null,
  p_display_name text default 'Efí Bank',
  p_environment text default 'PRODUCTION',
  p_client_id text default null,
  p_client_secret text default null,
  p_certificate_base64 text default null,
  p_certificate_password text default null,
  p_pix_key text default null
)
returns table(integration_id uuid, webhook_hmac text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
  v_existing uuid;
  v_secret_id uuid;
  v_name text;
  v_hmac text;
begin
  if v_user_id is null then raise exception 'Usuário não autenticado'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.owner_id = v_user_id
  ) then
    raise exception 'Conta não pertence ao usuário autenticado';
  end if;

  if p_environment not in ('SANDBOX','PRODUCTION') then
    raise exception 'Ambiente Efí inválido';
  end if;

  if char_length(trim(coalesce(p_display_name,''))) < 1
     or char_length(trim(p_display_name)) > 80 then
    raise exception 'Nome da integração deve ter entre 1 e 80 caracteres';
  end if;

  if p_integration_id is null then
    if nullif(trim(coalesce(p_client_id,'')),'') is null
       or nullif(trim(coalesce(p_client_secret,'')),'') is null
       or nullif(trim(coalesce(p_certificate_base64,'')),'') is null
       or nullif(trim(coalesce(p_pix_key,'')),'') is null then
      raise exception 'Client ID, Client Secret, certificado P12 e chave Pix são obrigatórios no cadastro Efí';
    end if;

    insert into public.payment_integrations(account_id,provider,environment,display_name,status)
    values(p_account_id,'EFI',p_environment,trim(p_display_name),'ACTIVE')
    returning id into v_id;
  else
    select pi.account_id into v_existing
      from public.payment_integrations pi
     where pi.id=p_integration_id and pi.provider='EFI';

    if v_existing is null then raise exception 'Integração Efí não encontrada'; end if;
    if v_existing <> p_account_id then raise exception 'Integração não pertence à conta informada'; end if;

    v_id := p_integration_id;

    update public.payment_integrations
       set environment=p_environment,
           display_name=trim(p_display_name),
           status='ACTIVE',
           updated_at=now()
     where id=v_id;
  end if;

  update public.payment_integrations
     set status='INACTIVE',updated_at=now()
   where account_id=p_account_id
     and provider='EFI'
     and id<>v_id
     and status='ACTIVE';

  if nullif(trim(coalesce(p_client_id,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_efi_client_id';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(trim(p_client_id),v_name,'Efí Client ID');
    else
      perform vault.update_secret(v_secret_id,trim(p_client_id));
    end if;
  end if;

  if nullif(trim(coalesce(p_client_secret,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_efi_client_secret';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(trim(p_client_secret),v_name,'Efí Client Secret');
    else
      perform vault.update_secret(v_secret_id,trim(p_client_secret));
    end if;
  end if;

  if nullif(trim(coalesce(p_certificate_base64,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_efi_certificate_base64';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(trim(p_certificate_base64),v_name,'Efí certificado P12 em Base64');
    else
      perform vault.update_secret(v_secret_id,trim(p_certificate_base64));
    end if;
  end if;

  if nullif(trim(coalesce(p_certificate_password,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_efi_certificate_password';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(p_certificate_password,v_name,'Efí senha do certificado P12');
    else
      perform vault.update_secret(v_secret_id,p_certificate_password);
    end if;
  end if;

  if nullif(trim(coalesce(p_pix_key,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_efi_pix_key';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(trim(p_pix_key),v_name,'Efí chave Pix');
    else
      perform vault.update_secret(v_secret_id,trim(p_pix_key));
    end if;
  end if;

  if not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_efi_webhook_hmac') then
    v_hmac:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    perform vault.create_secret(v_hmac,'pix_'||v_id::text||'_efi_webhook_hmac','Efí HMAC do webhook');
  end if;

  if not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_efi_client_id')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_efi_client_secret')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_efi_certificate_base64')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_efi_pix_key')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_efi_webhook_hmac') then
    raise exception 'Credenciais Efí incompletas';
  end if;

  update public.payment_integrations
     set status='ACTIVE',updated_at=now()
   where id=v_id;

  return query
  select v_id,
         (select decrypted_secret
            from vault.decrypted_secrets
           where name='pix_'||v_id::text||'_efi_webhook_hmac'
           limit 1);
end;
$$;

revoke all on function public.save_efi_integration(uuid,uuid,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.save_efi_integration(uuid,uuid,text,text,text,text,text,text,text) to authenticated,service_role;

create or replace function public.get_efi_integration_credentials(p_integration_id uuid)
returns table(
  integration_id uuid,
  environment text,
  client_id text,
  client_secret text,
  certificate_base64 text,
  certificate_password text,
  pix_key text,
  webhook_hmac text
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    then raise exception 'Acesso restrito ao service_role'; end if;

  return query
  select pi.id,
         pi.environment,
         (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_efi_client_id' limit 1),
         (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_efi_client_secret' limit 1),
         (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_efi_certificate_base64' limit 1),
         (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_efi_certificate_password' limit 1),
         (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_efi_pix_key' limit 1),
         (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_efi_webhook_hmac' limit 1)
    from public.payment_integrations pi
   where pi.id=p_integration_id
     and pi.provider='EFI'
     and pi.status='ACTIVE';
end;
$$;

revoke all on function public.get_efi_integration_credentials(uuid) from public,anon,authenticated;
grant execute on function public.get_efi_integration_credentials(uuid) to service_role;
