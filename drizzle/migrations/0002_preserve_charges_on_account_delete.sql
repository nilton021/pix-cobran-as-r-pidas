-- Preserva cobranças ao impedir exclusão em cascata da conta proprietária.
alter table public.charges drop constraint if exists charges_account_id_fkey;
alter table public.charges
  add constraint charges_account_id_fkey
  foreign key (account_id) references public.accounts(id) on delete restrict;
