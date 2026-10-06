-- Fase 10: webhooks de cliente por conta.
-- O segredo de assinatura fica no Vault; a tabela guarda somente a referência.

create table public.customer_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  url text not null,
  secret_name text not null unique,
  events jsonb not null default '["charge.status_changed"]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_webhook_url_https check (url ~ '^https://'),
  constraint customer_webhook_events_array check (jsonb_typeof(events) = 'array')
);

create index customer_webhook_endpoints_account_idx
  on public.customer_webhook_endpoints(account_id);

create trigger customer_webhook_endpoints_updated_at
before update on public.customer_webhook_endpoints
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.customer_webhook_endpoints to authenticated;
grant all on public.customer_webhook_endpoints to service_role;

alter table public.customer_webhook_endpoints enable row level security;

create policy "own customer webhook endpoints select"
on public.customer_webhook_endpoints
for select to authenticated
using (
  exists (
    select 1 from public.accounts a
    where a.id = customer_webhook_endpoints.account_id
      and a.owner_id = auth.uid()
  )
);

create policy "own customer webhook endpoints insert"
on public.customer_webhook_endpoints
for insert to authenticated
with check (
  exists (
    select 1 from public.accounts a
    where a.id = customer_webhook_endpoints.account_id
      and a.owner_id = auth.uid()
  )
);

create policy "own customer webhook endpoints update"
on public.customer_webhook_endpoints
for update to authenticated
using (
  exists (
    select 1 from public.accounts a
    where a.id = customer_webhook_endpoints.account_id
      and a.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.accounts a
    where a.id = customer_webhook_endpoints.account_id
      and a.owner_id = auth.uid()
  )
);

create policy "own customer webhook endpoints delete"
on public.customer_webhook_endpoints
for delete to authenticated
using (
  exists (
    select 1 from public.accounts a
    where a.id = customer_webhook_endpoints.account_id
      and a.owner_id = auth.uid()
  )
);

create or replace function public.set_customer_webhook_secret(
  p_endpoint_id uuid,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_secret_name text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Acesso não autorizado';
  end if;

  if length(p_secret) < 32 then
    raise exception 'Segredo de webhook inválido';
  end if;

  select secret_name into v_secret_name
  from public.customer_webhook_endpoints
  where id = p_endpoint_id;

  if not found then
    raise exception 'Webhook do cliente não encontrado';
  end if;

  insert into vault.secrets(name, secret, description)
  values (v_secret_name, p_secret, 'Segredo de assinatura do webhook do cliente')
  on conflict (name) do update
    set secret = excluded.secret,
        description = excluded.description;
end;
$$;

revoke all on function public.set_customer_webhook_secret(uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_customer_webhook_secret(uuid, text)
  to service_role;

create or replace function public.get_customer_webhook_secret(
  p_endpoint_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_secret text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Acesso não autorizado';
  end if;

  select ds.decrypted_secret into v_secret
  from public.customer_webhook_endpoints e
  join vault.decrypted_secrets ds on ds.name = e.secret_name
  where e.id = p_endpoint_id
    and e.active = true;

  if v_secret is null then
    raise exception 'Segredo do webhook não configurado';
  end if;

  return v_secret;
end;
$$;

revoke all on function public.get_customer_webhook_secret(uuid)
  from public, anon, authenticated;
grant execute on function public.get_customer_webhook_secret(uuid)
  to service_role;

comment on table public.customer_webhook_endpoints is
  'Endpoints de webhook dos clientes; segredos ficam exclusivamente no Supabase Vault.';
