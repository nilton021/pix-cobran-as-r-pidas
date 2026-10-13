-- Remoção segura: preserva a integração como INACTIVE para manter o vínculo
-- com cobranças históricas, mas apaga as credenciais relacionadas do Vault.
-- Bloqueia a remoção das credenciais enquanto houver cobranças PENDING associadas.
create or replace function public.delete_payment_integration(p_integration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_account_id uuid;
  v_prefix text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select pi.account_id
    into v_account_id
    from public.payment_integrations pi
   where pi.id = p_integration_id
   for update;

  if v_account_id is null then
    raise exception 'Integração não encontrada';
  end if;

  if not exists (
    select 1
      from public.accounts a
     where a.id = v_account_id
       and a.owner_id = v_user_id
  ) then
    raise exception 'Integração não pertence ao usuário autenticado';
  end if;

  if exists (
    select 1
      from public.charges c
     where c.payment_integration_id = p_integration_id
       and c.status = 'PENDING'
  ) then
    raise exception 'Existem cobranças pendentes nesta integração. Cancele-as ou aguarde o pagamento antes de excluir.';
  end if;

  -- Não apaga o registro pai: cobranças antigas podem referenciá-lo.
  -- Todas as credenciais e segredos de webhook desta integração são removidos.
  v_prefix := 'pix_' || p_integration_id::text || '_';
  delete from vault.secrets s
   where left(s.name, length(v_prefix)) = v_prefix;

  update public.payment_integrations
     set status = 'INACTIVE',
         updated_at = now()
   where id = p_integration_id;
end;
$$;

revoke all on function public.delete_payment_integration(uuid) from public, anon;
grant execute on function public.delete_payment_integration(uuid) to authenticated;
