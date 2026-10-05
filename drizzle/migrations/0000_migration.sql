
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  document text not null check (document ~ '^\d+$'),
  document_type text not null default 'CPF' check (document_type in ('CPF','CNPJ')),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;
alter table public.accounts enable row level security;
create policy "own accounts select" on public.accounts for select to authenticated using (owner_id = auth.uid());
create policy "own accounts insert" on public.accounts for insert to authenticated with check (owner_id = auth.uid());
create policy "own accounts update" on public.accounts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own accounts delete" on public.accounts for delete to authenticated using (owner_id = auth.uid());
create index accounts_owner_idx on public.accounts(owner_id);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 1),
  description text,
  status text not null default 'PENDING' check (status in ('PENDING','PAID','EXPIRED','CANCELED','DENIED','ERROR','REFUNDED','PARTIAL','CHARGEBACK')),
  picpay_charge_id text,
  qr_code text,
  qr_code_base64 text,
  end_to_end_id text,
  payer jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.charges to authenticated;
grant all on public.charges to service_role;
alter table public.charges enable row level security;
create policy "own charges select" on public.charges for select to authenticated
  using (exists (select 1 from public.accounts a where a.id = charges.account_id and a.owner_id = auth.uid()));
create index charges_account_created_idx on public.charges(account_id, created_at desc);
create index charges_pending_idx on public.charges(created_at) where status = 'PENDING';

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger charges_updated_at before update on public.charges for each row execute function public.set_updated_at();

alter table public.charges replica identity full;
alter publication supabase_realtime add table public.charges;

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  status text,
  merchant_charge_id text,
  payload jsonb,
  received_at timestamptz not null default now()
);
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;

-- Configuração interna (segredo do cron) — só service role
create table public.app_config (
  key text primary key,
  value text not null
);
grant all on public.app_config to service_role;
alter table public.app_config enable row level security;
create extension if not exists pgcrypto;
insert into public.app_config(key, value) values ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net;
