-- Fase 22: corrigir criação automática de perfil após signup.
-- O trigger de auth.users roda como supabase_auth_admin; a função precisa
-- executar a inserção em profiles com os privilégios do owner da função.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
grant execute on function public.handle_new_user_profile() to service_role;
