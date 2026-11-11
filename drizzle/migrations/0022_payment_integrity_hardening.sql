-- Payment integrity hardening (single migration).
-- Safe to review before applying. This migration intentionally fails closed if
-- existing duplicate provider IDs are found; it never deletes or rewrites charges.

-- 1) Prevent duplicate provider charge IDs within the same integration.
-- NULL IDs remain allowed (partial index); identical provider IDs belonging to
-- different integrations remain valid.
do $$
begin
  if exists (
    select 1
      from public.charges
     where provider_charge_id is not null
     group by payment_integration_id, provider_charge_id
    having count(*) > 1
  ) then
    raise exception 'Migration aborted: duplicate (payment_integration_id, provider_charge_id) values exist. Resolve duplicates explicitly before retrying.';
  end if;
end;
$$;

create unique index if not exists charges_provider_charge_unique
  on public.charges (payment_integration_id, provider_charge_id)
  where provider_charge_id is not null;

-- 2) Guard critical payment-status transitions without blocking idempotent
-- updates or future provider-specific statuses. PENDING may progress only to
-- the documented terminal/payment states. PAID cannot regress to PENDING.
create or replace function public.guard_charge_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'PAID' and new.status = 'PENDING' then
    raise exception 'Invalid charge status transition: PAID -> PENDING'
      using errcode = 'check_violation';
  end if;

  if old.status = 'PENDING'
     and new.status not in ('PAID', 'EXPIRED', 'CANCELED', 'DENIED', 'ERROR') then
    raise exception 'Invalid charge status transition: PENDING -> %', new.status
      using errcode = 'check_violation';
  end if;

  if old.status = 'PAID'
     and new.status not in ('REFUNDED', 'PARTIAL', 'CHARGEBACK') then
    raise exception 'Invalid charge status transition: PAID -> %', new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists charges_guard_status_transition on public.charges;
create trigger charges_guard_status_transition
before update of status on public.charges
for each row
execute function public.guard_charge_status_transition();

revoke all on function public.guard_charge_status_transition() from public, anon, authenticated;
grant execute on function public.guard_charge_status_transition() to service_role;

comment on function public.guard_charge_status_transition() is
  'Validates charge status transitions; blocks PAID regressions and invalid transitions from PENDING/PAID.';

-- NOTE: Environment-isolation and table privilege changes are deliberately not
-- applied here until the live function definitions and grants can be audited.
-- Do not apply this migration to production before the remaining review and CI.
