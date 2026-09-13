begin;
-- KRX now includes alphanumeric codes such as 0165X0.
alter table public.company_follows drop constraint company_follows_company_id_check;
alter table public.company_follows add constraint company_follows_company_id_check
  check (company_id ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$');
commit;
