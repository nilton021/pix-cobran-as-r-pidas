-- Fix Asaas credential RPC authorization across Supabase/PostgREST JWT claim formats.
-- The legacy single-claim setting is preferred when present; the JSON claims
-- fallback is used only when the legacy role claim is absent or empty.
-- Malformed JSON fails closed and cannot grant access.
create or replace function public.get_asaas_integration_credentials(p_integration_id uuid)
returns table(integration_id uuid, environment text, api_key text, webhook_secret text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role' then
    raise exception 'Acesso restrito ao service_role';
  end if;

  return query
  select pi.id,
         pi.environment,
         (select s.decrypted_secret
            from vault.decrypted_secrets s
           where s.name = 'pix_' || pi.id::text || '_api_key'
           limit 1),
         (select s.decrypted_secret
            from vault.decrypted_secrets s
           where s.name = 'pix_' || pi.id::text || '_webhook_secret'
           limit 1)
    from public.payment_integrations pi
   where pi.id = p_integration_id
     and pi.provider = 'ASAAS'
     and pi.status = 'ACTIVE';
end;
$$;

revoke all on function public.get_asaas_integration_credentials(uuid)
  from public, anon, authenticated;
grant execute on function public.get_asaas_integration_credentials(uuid)
  to service_role;
