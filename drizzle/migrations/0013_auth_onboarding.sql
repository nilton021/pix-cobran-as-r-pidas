-- Fase 17: fundação de autenticação e onboarding.
-- Dados de perfil ficam separados de auth.users e isolados por RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 120)
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "own profiles select" on public.profiles;
create policy "own profiles select" on public.profiles for select to authenticated
  using (id = auth.uid());
drop policy if exists "own profiles insert" on public.profiles;
create policy "own profiles insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists "own profiles update" on public.profiles;
create policy "own profiles update" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
grant execute on function public.handle_new_user_profile() to service_role;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles(id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;

create index if not exists profiles_onboarding_idx
  on public.profiles(onboarding_completed, created_at);

comment on table public.profiles is
  'Perfil mínimo do usuário autenticado e estado de onboarding; dados isolados por auth.uid().';
