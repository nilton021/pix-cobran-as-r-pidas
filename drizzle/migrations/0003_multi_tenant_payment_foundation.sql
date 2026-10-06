-- Fase 1: fundação multi-tenant para integrações de pagamento e API keys.
-- Não armazena credenciais PicPay nesta migration.
-- payment_integration_id permanece nullable para preservar cobranças legadas
-- até que o backfill da fase de migração de dados seja concluído.

create table public.payment_integrations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  provider text not null check (provider in ('PICPAY')),
  environment text not null default 'SANDBOX' check (environment in ('SANDBOX', 'PRODUCTION')),
  display_name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'ERROR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_integrations_account_provider_env_idx
  on public.payment_integrations(account_id, provider, environment);

create trigger payment_integrations_updated_at
before update on public.payment_integrations
for each row execute function public.set_updated_at();

grant select, insert, update on public.payment_integrations to authenticated;
grant all on public.payment_integrations to service_role;

alter table public.payment_integrations enable row level security;

create policy "own payment integrations select"
on public.payment_integrations
for select to authenticated
using (
  exists (
    select 1
    from public.accounts a
    where a.id = payment_integrations.account_id
      and a.owner_id = auth.uid()
  )
);

create policy "own payment integrations insert"
on public.payment_integrations
for insert to authenticated
with check (
  exists (
    select 1
    from public.accounts a
    where a.id = payment_integrations.account_id
      and a.owner_id = auth.uid()
  )
);

create policy "own payment integrations update"
on public.payment_integrations
for update to authenticated
using (
  exists (
    select 1
    from public.accounts a
    where a.id = payment_integrations.account_id
      and a.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.accounts a
    where a.id = payment_integrations.account_id
      and a.owner_id = auth.uid()
  )
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index api_keys_key_prefix_idx
  on public.api_keys(key_prefix);

create index api_keys_account_idx
  on public.api_keys(account_id);

grant all on public.api_keys to service_role;

-- O hash completo nunca é exposto diretamente ao cliente autenticado.
-- A criação/rotação/revogação definitiva da API key será feita pelo backend.
grant select (
  id,
  account_id,
  name,
  key_prefix,
  last_used_at,
  expires_at,
  revoked_at,
  created_at
) on public.api_keys to authenticated;

grant update (
  name,
  expires_at,
  revoked_at
) on public.api_keys to authenticated;

alter table public.api_keys enable row level security;

create policy "own api keys select"
on public.api_keys
for select to authenticated
using (
  exists (
    select 1
    from public.accounts a
    where a.id = api_keys.account_id
      and a.owner_id = auth.uid()
  )
);

create policy "own api keys update"
on public.api_keys
for update to authenticated
using (
  exists (
    select 1
    from public.accounts a
    where a.id = api_keys.account_id
      and a.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.accounts a
    where a.id = api_keys.account_id
      and a.owner_id = auth.uid()
  )
);

alter table public.charges
  add column payment_integration_id uuid;

alter table public.charges
  add constraint charges_payment_integration_id_fkey
  foreign key (payment_integration_id)
  references public.payment_integrations(id)
  on delete restrict;

create index charges_payment_integration_idx
  on public.charges(payment_integration_id);

comment on column public.charges.payment_integration_id is
  'Integração de pagamento que originou a cobrança; nullable durante o período de backfill das cobranças legadas.';
