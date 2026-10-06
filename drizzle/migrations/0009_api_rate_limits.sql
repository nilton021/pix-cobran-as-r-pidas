-- Fase 13: proteção contra abuso da API pública.
-- O contador é persistido no Postgres para funcionar entre múltiplas instâncias.

create table public.api_rate_limit_buckets (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  route text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (api_key_id, route, window_start)
);

create index api_rate_limit_buckets_window_idx
  on public.api_rate_limit_buckets(window_start);

grant all on public.api_rate_limit_buckets to service_role;
alter table public.api_rate_limit_buckets enable row level security;

create or replace function public.consume_api_rate_limit(
  p_api_key_id uuid,
  p_route text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Acesso não autorizado';
  end if;

  if p_limit < 1 or p_window_seconds < 1 or length(trim(p_route)) = 0 then
    raise exception 'Parâmetros de rate limit inválidos';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limit_buckets(api_key_id, route, window_start, request_count)
  values (p_api_key_id, p_route, v_window_start, 1)
  on conflict (api_key_id, route, window_start)
  do update set request_count = public.api_rate_limit_buckets.request_count + 1
  returning request_count into v_count;

  if v_count <= p_limit then
    return query select true, p_limit - v_count, greatest(
      1,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - clock_timestamp())))::integer
    );
  else
    return query select false, 0, greatest(
      1,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - clock_timestamp())))::integer
    );
  end if;
end;
$$;

revoke all on function public.consume_api_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(uuid, text, integer, integer)
  to service_role;

comment on function public.consume_api_rate_limit(uuid, text, integer, integer) is
  'Consome uma unidade de rate limit por API key e rota em janela fixa; execução restrita ao service_role.';
