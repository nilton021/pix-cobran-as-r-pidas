-- Fase 14: idempotência da API pública de cobranças.
-- Uma mesma API key + Idempotency-Key só pode representar uma cobrança.

create table public.api_idempotency_keys (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  charge_id uuid references public.charges(id) on delete restrict,
  response_status integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (api_key_id, idempotency_key),
  constraint api_idempotency_key_length check (length(idempotency_key) between 1 and 255),
  constraint api_idempotency_hash_length check (length(request_hash) = 64)
);

create index api_idempotency_created_idx
  on public.api_idempotency_keys(created_at);

grant all on public.api_idempotency_keys to service_role;
alter table public.api_idempotency_keys enable row level security;

comment on table public.api_idempotency_keys is
  'Chaves de idempotência da API pública, isoladas por API key e sem armazenamento do payload original.';
