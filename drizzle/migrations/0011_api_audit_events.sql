-- Fase 15: auditoria e observabilidade da API pública.
-- Não armazena payloads, Authorization, API keys ou segredos.

create table public.api_audit_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  request_id text not null,
  route text not null,
  method text not null,
  status_code integer not null,
  duration_ms integer not null check (duration_ms >= 0),
  event_type text not null default 'api_request',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index api_audit_events_created_idx on public.api_audit_events(created_at desc);
create index api_audit_events_account_idx on public.api_audit_events(account_id, created_at desc);
create index api_audit_events_api_key_idx on public.api_audit_events(api_key_id, created_at desc);

revoke all on public.api_audit_events from public, anon, authenticated;
grant all on public.api_audit_events to service_role;
alter table public.api_audit_events enable row level security;

comment on table public.api_audit_events is
  'Auditoria técnica da API pública sem payload, Authorization ou segredos.';
