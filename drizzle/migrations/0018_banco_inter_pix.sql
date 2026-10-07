-- Banco Inter API Pix: mTLS + OAuth2 credentials protected in Vault.
create or replace function public.save_inter_integration(
  p_account_id uuid,
  p_integration_id uuid default null,
  p_display_name text default 'Banco Inter',
  p_environment text default 'PRODUCTION',
  p_client_id text default null,
  p_client_secret text default null,
  p_cert_pem text default null,
  p_key_pem text default null,
  p_pix_key text default null,
  p_account_number text default null
)
returns uuid
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
begin
  if v_user_id is null then raise exception 'Usuário não autenticado'; end if;
  if not exists (select 1 from public.accounts a where a.id=p_account_id and a.owner_id=v_user_id)
    then raise exception 'Conta não pertence ao usuário autenticado'; end if;
  if p_environment not in ('SANDBOX','PRODUCTION') then raise exception 'Ambiente Inter inválido'; end if;
  if char_length(trim(coalesce(p_display_name,''))) < 1 or char_length(trim(p_display_name)) > 80
    then raise exception 'Nome da integração deve ter entre 1 e 80 caracteres'; end if;

  if p_integration_id is null then
    if nullif(trim(coalesce(p_client_id,'')),'') is null
       or nullif(trim(coalesce(p_client_secret,'')),'') is null
       or nullif(trim(coalesce(p_cert_pem,'')),'') is null
       or nullif(trim(coalesce(p_key_pem,'')),'') is null
       or nullif(trim(coalesce(p_pix_key,'')),'') is null then
      raise exception 'Client ID, Client Secret, certificado, chave privada e chave Pix são obrigatórios no cadastro Inter';
    end if;
    insert into public.payment_integrations(account_id,provider,environment,display_name,status)
    values(p_account_id,'INTER',p_environment,trim(p_display_name),'ACTIVE')
    returning id into v_id;
  else
    select pi.account_id into v_existing from public.payment_integrations pi
      where pi.id=p_integration_id and pi.provider='INTER';
    if v_existing is null then raise exception 'Integração Banco Inter não encontrada'; end if;
    if v_existing <> p_account_id then raise exception 'Integração não pertence à conta informada'; end if;
    v_id := p_integration_id;
    update public.payment_integrations set environment=p_environment,display_name=trim(p_display_name),
      status='ACTIVE',updated_at=now() where id=v_id;
  end if;

  update public.payment_integrations set status='INACTIVE',updated_at=now()
    where account_id=p_account_id and provider='INTER' and id<>v_id and status='ACTIVE';

  if nullif(trim(coalesce(p_client_id,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_inter_client_id';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then perform vault.create_secret(trim(p_client_id),v_name,'Banco Inter Client ID');
    else perform vault.update_secret(v_secret_id,trim(p_client_id)); end if;
  end if;
  if nullif(trim(coalesce(p_client_secret,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_inter_client_secret';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then perform vault.create_secret(trim(p_client_secret),v_name,'Banco Inter Client Secret');
    else perform vault.update_secret(v_secret_id,trim(p_client_secret)); end if;
  end if;
  if nullif(trim(coalesce(p_cert_pem,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_inter_cert_pem';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then perform vault.create_secret(p_cert_pem,v_name,'Banco Inter certificado mTLS');
    else perform vault.update_secret(v_secret_id,p_cert_pem); end if;
  end if;
  if nullif(trim(coalesce(p_key_pem,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_inter_key_pem';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then perform vault.create_secret(p_key_pem,v_name,'Banco Inter chave privada mTLS');
    else perform vault.update_secret(v_secret_id,p_key_pem); end if;
  end if;
  if nullif(trim(coalesce(p_pix_key,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_inter_pix_key';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then perform vault.create_secret(trim(p_pix_key),v_name,'Banco Inter chave Pix');
    else perform vault.update_secret(v_secret_id,trim(p_pix_key)); end if;
  end if;
  if nullif(trim(coalesce(p_account_number,'')),'') is not null then
    v_name:='pix_'||v_id::text||'_inter_account_number';
    select id into v_secret_id from vault.secrets where name=v_name limit 1;
    if v_secret_id is null then perform vault.create_secret(trim(p_account_number),v_name,'Banco Inter conta corrente');
    else perform vault.update_secret(v_secret_id,trim(p_account_number)); end if;
  end if;

  if not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_inter_client_id')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_inter_client_secret')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_inter_cert_pem')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_inter_key_pem')
     or not exists(select 1 from vault.secrets where name='pix_'||v_id::text||'_inter_pix_key') then
    raise exception 'Credenciais Banco Inter incompletas';
  end if;
  update public.payment_integrations set status='ACTIVE',updated_at=now() where id=v_id;
  return v_id;
end;
$$;

revoke all on function public.save_inter_integration(uuid,uuid,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.save_inter_integration(uuid,uuid,text,text,text,text,text,text,text,text) to authenticated,service_role;

create or replace function public.get_inter_integration_credentials(p_integration_id uuid)
returns table(
  integration_id uuid, environment text, client_id text, client_secret text,
  cert_pem text, key_pem text, pix_key text, account_number text
)
language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    then raise exception 'Acesso restrito ao service_role'; end if;
  return query select pi.id,pi.environment,
    (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_inter_client_id' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_inter_client_secret' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_inter_cert_pem' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_inter_key_pem' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_inter_pix_key' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name='pix_'||pi.id::text||'_inter_account_number' limit 1)
  from public.payment_integrations pi
  where pi.id=p_integration_id and pi.provider='INTER' and pi.status='ACTIVE';
end;
$$;

revoke all on function public.get_inter_integration_credentials(uuid) from public,anon,authenticated;
grant execute on function public.get_inter_integration_credentials(uuid) to service_role;
