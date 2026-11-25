-- Testes reais pós-aplicação. Executar integralmente: nenhuma linha de teste fica salva.
-- Não habilita flags, cron ou pagamentos. Concorrência multiconexão NÃO é testada aqui.
begin;
do $$
declare
  owner uuid;
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  integration uuid;
  sid uuid := gen_random_uuid();
  other_sid uuid := gen_random_uuid();
  pix uuid;
  result jsonb;
  replay jsonb;
  event uuid;
  lease uuid := gen_random_uuid();
  initial_role text := current_user;
  allowed integer := 0;
  visible integer;
  changed integer;
begin
  select owner_id into owner from public.accounts limit 1;
  if owner is null then raise exception 'Test requires an existing account owner'; end if;
  insert into public.accounts(id,owner_id,name,email,document)
    values(a,owner,'Validação temporária cartão A','card-validation-a@example.invalid','00000000000'),
          (b,owner,'Validação temporária cartão B','card-validation-b@example.invalid','00000000000');
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  integration := public.card_nfc_prepare_mock(a,owner);
  insert into public.charges(account_id,amount_cents) values(a,1500) returning id into pix;
  if (select payment_method from public.charges where id=pix) <> 'PIX' then
    raise exception 'Omitted payment method must default to PIX';
  end if;
  result := public.card_nfc_create_session(a,actor,'validation',repeat('a',64),integration,1500,null,null,sid,'mock_'||sid);
  replay := public.card_nfc_create_session(a,actor,'validation',repeat('a',64),integration,1500,null,null,other_sid,'mock_'||other_sid);
  if result->>'replay'<>'false' or replay->>'replay'<>'true'
    or result->'session'->>'id'<>replay->'session'->>'id'
    or (select count(*) from public.card_present_sessions where account_id=a)<>1
    or (select count(*) from public.card_present_requests where account_id=a)<>1 then
    raise exception 'Sequential idempotency failed';
  end if;
  begin
    perform public.card_nfc_create_session(a,actor,'validation',repeat('b',64),integration,1600,null,null,other_sid,'mock_'||other_sid);
    raise exception 'Changed request must conflict';
  exception when unique_violation then null; end;
  begin
    update public.card_present_sessions set account_id=b where id=sid;
    raise exception 'Cross-account session accepted';
  exception when check_violation or foreign_key_violation then null; end;
  begin
    update public.charges set account_id=b where id=(result->'session'->>'charge_id')::uuid;
    raise exception 'Cross-account parent reassignment accepted';
  exception when foreign_key_violation or check_violation then null; end;
  if not public.card_nfc_enqueue_event('ValidationApproved',integration,'mock_'||sid,1500,'APPROVED',now(),repeat('c',64)) then
    raise exception 'Initial event rejected';
  end if;
  if public.card_nfc_enqueue_event('ValidationApproved',integration,'mock_'||sid,1500,'APPROVED',now(),repeat('c',64)) then
    raise exception 'Duplicate event accepted';
  end if;
  select id into event from public.card_present_events where session_id=sid;
  update public.card_present_events set state='PROCESSING',attempts=1,lease_id=lease,lease_until=now()+interval '30 seconds' where id=event;
  perform public.card_nfc_finish_event(event,gen_random_uuid());
  if (select state from public.card_present_events where id=event)<>'PROCESSING' then
    raise exception 'Wrong lease changed event';
  end if;
  perform public.card_nfc_finish_event(event,lease);
  if (select status from public.card_present_sessions where id=sid)<>'APPROVED'
    or (select status from public.charges where id=(result->'session'->>'charge_id')::uuid)<>'PENDING'
    or (select paid_at from public.charges where id=(result->'session'->>'charge_id')::uuid) is not null then
    raise exception 'MOCK approval must not produce a paid receipt';
  end if;
  for i in 1..11 loop
    if public.card_nfc_consume_limit(a,actor) then allowed:=allowed+1; end if;
  end loop;
  if allowed<>10 then raise exception 'Exactly ten sequential calls must be allowed'; end if;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',owner)::text,true);
  perform set_config('request.jwt.claim.sub',owner::text,true);
  execute 'set local role authenticated';
  select count(*) into visible from public.card_present_sessions where id=sid;
  if visible<>1 then raise exception 'Owner cannot read its session'; end if;
  begin
    update public.card_present_sessions set status='CANCELED' where id=sid;
    get diagnostics changed = row_count;
    if changed<>0 then raise exception 'Client wrote a session'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.card_present_events(session_id,payment_integration_id,event_id,payload_hash,amount_cents,status,signed_at)
      values(sid,integration,'DeniedClientEvent',repeat('d',64),1500,'APPROVED',now());
    raise exception 'Client wrote an event';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('request.jwt.claim.sub'))::text,true);
  select count(*) into visible from public.card_present_sessions where id=sid;
  if visible<>0 then raise exception 'Other user can read session'; end if;
  execute format('set local role %I',initial_role);
  raise notice 'PASS: PIX default, sequential idempotency/conflict, tenant constraints, durable replay, lease fencing, MOCK not paid, ten-call limit, owner/stranger RLS and denied client writes';
end $$;
rollback;