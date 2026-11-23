-- PROPOSTA NÃO APLICADA. Fora do journal e do diretório gerenciado.
-- Revisão + confirmação explícita + integração ao apply-phase-22-migrations exigidas.
-- PostgreSQL >= 11: default constante usa fast default (sem reescrever cobranças antigas).
begin;
-- Falhar fechado se MERCADOPAGO não estiver reservado; não substituir constraint existente.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.payment_integrations'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%MERCADOPAGO%') then
    raise exception 'Pré-requisito: MERCADOPAGO reservado pela 0017';
  end if;
end $$;
alter table public.charges add column if not exists payment_method text not null default 'PIX';
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.charges'::regclass and conname='charges_payment_method_check') then
    alter table public.charges add constraint charges_payment_method_check check(payment_method in ('PIX','CARD_NFC'));
  end if;
end $$;

-- FKs compostas também impedem alterações futuras dos pais que cruzem contas.
create unique index if not exists card_nfc_charge_identity_idx on public.charges(id,account_id,payment_integration_id,amount_cents);
create unique index if not exists card_nfc_integration_identity_idx on public.payment_integrations(id,account_id);
create table if not exists public.card_present_sessions (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id),
  account_id uuid not null references public.accounts(id),
  payment_integration_id uuid not null references public.payment_integrations(id),
  provider text not null check(provider='MOCK'),
  provider_session_id text not null check(provider_session_id ~ '^mock_[0-9a-f-]{36}$'),
  amount_cents integer not null check(amount_cents>0),
  status text not null default 'CREATED' check(status in ('CREATED','AWAITING_CARD','APPROVED','DECLINED','CANCELED','EXPIRED','REFUNDED')),
  device_id text,
  external_reference text,
  request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
  last_event_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(payment_integration_id,provider_session_id), unique(charge_id), unique(account_id,external_reference),
  foreign key(charge_id,account_id,payment_integration_id,amount_cents) references public.charges(id,account_id,payment_integration_id,amount_cents),
  foreign key(payment_integration_id,account_id) references public.payment_integrations(id,account_id),
  check(device_id is null or (device_id ~ '^[A-Za-z][A-Za-z0-9_-]{0,79}$' and device_id !~ '[0-9]{12,19}')),
  check(external_reference is null or (external_reference ~ '^[A-Za-z][A-Za-z0-9_-]{0,79}$' and external_reference !~ '[0-9]{12,19}'))
);
grant select on public.card_present_sessions to authenticated;
grant all on public.card_present_sessions to service_role;
alter table public.card_present_sessions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='card_present_sessions' and policyname='card_nfc_owner_read') then
    create policy card_nfc_owner_read on public.card_present_sessions for select to authenticated
      using (exists(select 1 from public.accounts a where a.id=card_present_sessions.account_id and a.owner_id=auth.uid()));
  end if;
end $$;
create index if not exists card_present_charge_idx on public.card_present_sessions(charge_id);
create index if not exists card_present_provider_session_idx on public.card_present_sessions(provider_session_id);
create index if not exists card_present_expiration_idx on public.card_present_sessions(expires_at) where status in ('CREATED','AWAITING_CARD');

create table if not exists public.card_present_requests (
  account_id uuid not null references public.accounts(id), actor_id uuid not null,
  idempotency_key text not null check(length(idempotency_key) between 1 and 255 and idempotency_key ~ '^[A-Za-z0-9_-]+$' and idempotency_key !~ '[0-9]{12,19}'),
  request_hash text not null, session_id uuid not null references public.card_present_sessions(id),
  created_at timestamptz not null default now(), primary key(account_id,actor_id,idempotency_key)
);
grant all on public.card_present_requests to service_role;
alter table public.card_present_requests enable row level security;

create table if not exists public.card_present_rate_buckets (
  account_id uuid not null references public.accounts(id), actor_id uuid not null,
  window_start timestamptz not null, hits integer not null, primary key(account_id,actor_id,window_start)
);
grant all on public.card_present_rate_buckets to service_role;
alter table public.card_present_rate_buckets enable row level security;

-- Fila própria. Nenhum JSON/payload bruto, nome de pagador ou dados de cartão.
create table if not exists public.card_present_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.card_present_sessions(id),
  payment_integration_id uuid not null references public.payment_integrations(id),
  event_id text not null check(event_id ~ '^[A-Za-z][A-Za-z0-9_-]{0,79}$' and event_id !~ '[0-9]{12,19}'),
  payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
  amount_cents integer not null check(amount_cents>0),
  status text not null check(status in ('CREATED','AWAITING_CARD','APPROVED','DECLINED','CANCELED','EXPIRED','REFUNDED')),
  signed_at timestamptz not null, received_at timestamptz not null default now(),
  state text not null default 'READY' check(state in ('READY','PROCESSING','DONE','REJECTED')),
  attempts integer not null default 0, lease_id uuid, lease_until timestamptz,
  unique(payment_integration_id,event_id)
);
grant all on public.card_present_events to service_role;
alter table public.card_present_events enable row level security;
create index if not exists card_present_event_queue_idx on public.card_present_events(state,lease_until,received_at);

-- Auxiliares novos: nenhum CREATE OR REPLACE de função Pix existente.
create or replace function public.card_nfc_require_service() returns void language plpgsql set search_path='' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    and coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
end $$;

create or replace function public.card_nfc_validate_session() returns trigger language plpgsql set search_path='' as $$
begin
  -- Bloqueia os pais contra mudanças concorrentes durante a validação.
  perform 1 from public.charges c join public.payment_integrations pi on pi.id=new.payment_integration_id
    where c.id=new.charge_id and c.account_id=new.account_id and pi.account_id=new.account_id
      and c.payment_integration_id=pi.id and c.payment_method='CARD_NFC' and c.amount_cents=new.amount_cents
      and pi.provider='MERCADOPAGO' and pi.environment='SANDBOX' and pi.status='INACTIVE'
    for share of c, pi;
  if not found then raise exception 'Card tenant/integration/charge mismatch' using errcode='23514'; end if;
  new.updated_at:=now(); return new;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.card_present_sessions'::regclass and tgname='card_nfc_validate_session') then
    create trigger card_nfc_validate_session before insert or update on public.card_present_sessions
      for each row execute function public.card_nfc_validate_session();
  end if;
end $$;

create or replace function public.card_nfc_consume_limit(p_account_id uuid,p_actor_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_hits integer; begin
  perform public.card_nfc_require_service();
  insert into public.card_present_rate_buckets(account_id,actor_id,window_start,hits)
    values(p_account_id,p_actor_id,date_trunc('minute',now()),1)
    on conflict(account_id,actor_id,window_start) do update set hits=card_present_rate_buckets.hits+1 returning hits into v_hits;
  return v_hits<=10;
end $$;

create or replace function public.card_nfc_prepare_mock(p_account_id uuid,p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
  perform public.card_nfc_require_service();
  perform 1 from public.accounts where id=p_account_id and owner_id=p_user_id for update;
  if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
  insert into public.payment_integrations(account_id,provider,environment,display_name,status)
    values(p_account_id,'MERCADOPAGO','SANDBOX','Cartão por aproximação · MOCK','INACTIVE')
    on conflict(account_id,provider,environment) do nothing;
  select id into v_id from public.payment_integrations where account_id=p_account_id
    and provider='MERCADOPAGO' and environment='SANDBOX' and status='INACTIVE';
  if v_id is null then raise exception 'Existing integration not eligible'; end if;
  return v_id;
end $$;

create or replace function public.card_nfc_create_session(
  p_account_id uuid,p_actor_id uuid,p_key text,p_hash text,p_integration_id uuid,p_amount integer,
  p_reference text,p_device_id text,p_session_id uuid,p_provider_session_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.card_present_sessions; v_charge_id uuid; v_request public.card_present_requests;
begin
  perform public.card_nfc_require_service();
  perform 1 from public.accounts where id=p_account_id for update;
  if not found then raise exception 'Account unavailable'; end if;
  -- Serialização por conta + charge/session/request na mesma transação: sem reservas órfãs.
  select * into v_request from public.card_present_requests
    where account_id=p_account_id and actor_id=p_actor_id and idempotency_key=p_key;
  if found then
    if v_request.request_hash<>p_hash then raise exception 'Idempotency conflict' using errcode='23505'; end if;
    select * into v_session from public.card_present_sessions where id=v_request.session_id;
    return jsonb_build_object('session',to_jsonb(v_session),'replay',true);
  end if;
  perform 1 from public.payment_integrations where id=p_integration_id and account_id=p_account_id
    and provider='MERCADOPAGO' and environment='SANDBOX' and status='INACTIVE' for share;
  if not found then raise exception 'Mock integration unavailable' using errcode='23514'; end if;
  if p_reference is not null then
    select * into v_session from public.card_present_sessions where account_id=p_account_id and external_reference=p_reference;
    if found then
      if v_session.request_hash<>p_hash then raise exception 'External reference conflict' using errcode='23505'; end if;
      insert into public.card_present_requests values(p_account_id,p_actor_id,p_key,p_hash,v_session.id,now());
      return jsonb_build_object('session',to_jsonb(v_session),'replay',true);
    end if;
  end if;
  -- MOCK nunca marca PAID: nenhuma entrada em totais financeiros de recebimentos.
  insert into public.charges(account_id,payment_integration_id,amount_cents,status,payment_method,expires_at)
    values(p_account_id,p_integration_id,p_amount,'PENDING','CARD_NFC',now()+interval '15 minutes') returning id into v_charge_id;
  insert into public.card_present_sessions(id,charge_id,account_id,payment_integration_id,provider,provider_session_id,
    amount_cents,status,device_id,external_reference,request_hash,expires_at)
    values(p_session_id,v_charge_id,p_account_id,p_integration_id,'MOCK',p_provider_session_id,p_amount,
      'AWAITING_CARD',p_device_id,p_reference,p_hash,now()+interval '15 minutes') returning * into v_session;
  insert into public.card_present_requests values(p_account_id,p_actor_id,p_key,p_hash,v_session.id,now());
  return jsonb_build_object('session',to_jsonb(v_session),'replay',false);
end $$;

create or replace function public.card_nfc_read_session(p_account_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_session public.card_present_sessions; begin
  perform public.card_nfc_require_service();
  select * into v_session from public.card_present_sessions where account_id=p_account_id and (id=p_id or charge_id=p_id);
  if not found then return null; end if;
  return to_jsonb(v_session);
end $$;

create or replace function public.card_nfc_enqueue_event(p_event_id text,p_integration_id uuid,p_provider_session_id text,
  p_amount integer,p_status text,p_signed_at timestamptz,p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_session public.card_present_sessions; v_inserted uuid; begin
  perform public.card_nfc_require_service();
  if abs(extract(epoch from now()-p_signed_at))>300 then raise exception 'Stale event'; end if;
  select * into v_session from public.card_present_sessions where payment_integration_id=p_integration_id
    and provider_session_id=p_provider_session_id;
  if not found or v_session.amount_cents<>p_amount then raise exception 'Session/amount mismatch'; end if;
  insert into public.card_present_events(session_id,payment_integration_id,event_id,payload_hash,amount_cents,status,signed_at)
    values(v_session.id,p_integration_id,p_event_id,p_hash,p_amount,p_status,p_signed_at)
    on conflict(payment_integration_id,event_id) do nothing returning id into v_inserted;
  return v_inserted is not null;
end $$;

create or replace function public.card_nfc_claim_events(p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ids jsonb; begin
  perform public.card_nfc_require_service();
  update public.card_present_events set state='REJECTED',lease_id=null,lease_until=null
    where state='PROCESSING' and lease_until<now() and attempts>=5;
  with candidate as (
    select id from public.card_present_events
    where (state='READY' or (state='PROCESSING' and lease_until<now())) and attempts<5
    order by received_at,id limit 20 for update skip locked
  ), leased as (
    update public.card_present_events e set state='PROCESSING',lease_id=p_lease,lease_until=now()+interval '30 seconds',attempts=e.attempts+1
      from candidate c where e.id=c.id returning e.id
  ) select coalesce(jsonb_agg(id),'[]'::jsonb) into v_ids from leased;
  return v_ids;
end $$;

create or replace function public.card_nfc_finish_event(p_id uuid,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.card_present_events; s public.card_present_sessions; begin
  perform public.card_nfc_require_service();
  select * into e from public.card_present_events where id=p_id and lease_id=p_lease
    and state='PROCESSING' and lease_until>=now() for update;
  if not found then return; end if;
  select * into s from public.card_present_sessions where id=e.session_id for update;
  if e.amount_cents<>s.amount_cents or (s.last_event_at is not null and e.signed_at<s.last_event_at)
    or (s.status='APPROVED' and e.status not in ('APPROVED','REFUNDED'))
    or (e.status='REFUNDED' and s.status not in ('APPROVED','REFUNDED'))
    or (s.status in ('DECLINED','CANCELED','EXPIRED','REFUNDED') and e.status<>s.status)
    or (s.status='AWAITING_CARD' and e.status='CREATED') then
    update public.card_present_events set state='REJECTED',lease_id=null,lease_until=null where id=e.id;
    return;
  end if;
  update public.card_present_sessions set status=e.status,last_event_at=e.signed_at where id=s.id;
  -- Apenas estados terminais não monetários; APPROVED MOCK nunca vira PAID.
  update public.charges set status=case e.status when 'CANCELED' then 'CANCELED' when 'EXPIRED' then 'EXPIRED'
    when 'DECLINED' then 'DENIED' else status end
    where id=s.charge_id and payment_method='CARD_NFC';
  update public.card_present_events set state='DONE',lease_id=null,lease_until=null where id=e.id;
end $$;

create or replace function public.card_nfc_expire_sessions() returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.card_nfc_require_service();
  with expired as (
    update public.card_present_sessions set status='EXPIRED' where status in ('CREATED','AWAITING_CARD') and expires_at<now() returning charge_id
  ) update public.charges set status='EXPIRED' where id in(select charge_id from expired) and payment_method='CARD_NFC';
end $$;

-- Remover os privilégios implícitos de execução, somente dos objetos novos desta proposta.
revoke all on function public.card_nfc_require_service() from public,anon,authenticated;
revoke all on function public.card_nfc_validate_session() from public,anon,authenticated;
revoke all on function public.card_nfc_consume_limit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.card_nfc_prepare_mock(uuid,uuid) from public,anon,authenticated;
revoke all on function public.card_nfc_create_session(uuid,uuid,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.card_nfc_read_session(uuid,uuid) from public,anon,authenticated;
revoke all on function public.card_nfc_enqueue_event(text,uuid,text,integer,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.card_nfc_claim_events(uuid) from public,anon,authenticated;
revoke all on function public.card_nfc_finish_event(uuid,uuid) from public,anon,authenticated;
revoke all on function public.card_nfc_expire_sessions() from public,anon,authenticated;
grant execute on function public.card_nfc_require_service(),public.card_nfc_validate_session(),public.card_nfc_consume_limit(uuid,uuid),
  public.card_nfc_prepare_mock(uuid,uuid),public.card_nfc_create_session(uuid,uuid,text,text,uuid,integer,text,text,uuid,text),
  public.card_nfc_read_session(uuid,uuid),public.card_nfc_enqueue_event(text,uuid,text,integer,text,timestamptz,text),
  public.card_nfc_claim_events(uuid),public.card_nfc_finish_event(uuid,uuid),public.card_nfc_expire_sessions() to service_role;
commit;
