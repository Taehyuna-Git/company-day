begin;
-- A 256-bit email link proves mailbox possession. Never accept a caller's user id.
create unique index email_verification_token_unique on public.email_verification_requests(token_hash);
create table public.email_verification_receipts (
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now()+interval '24 hours'
);
create index email_receipt_expiry on public.email_verification_receipts(expires_at);
alter table public.email_verification_receipts enable row level security;
revoke all on public.email_verification_receipts from public,anon,authenticated;
grant all on public.email_verification_receipts to service_role;

create function public.confirm_notification_email_link(p_token_hash text)
returns text language plpgsql security definer set search_path='' as $$
declare v_request public.email_verification_requests%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return 'invalid'; end if;
  -- Same lock as requests: confirmation, replacement and cancellation cannot race.
  perform pg_catalog.pg_advisory_xact_lock(72491001);
  delete from public.email_verification_receipts where expires_at<=now();
  if exists(select 1 from public.email_verification_receipts where token_hash=p_token_hash) then return 'already_verified'; end if;
  select * into v_request from public.email_verification_requests where token_hash=p_token_hash for update;
  if not found then return 'invalid'; end if;
  if v_request.expires_at<=now() then return 'expired'; end if;
  perform public.confirm_notification_email(v_request.user_id,p_token_hash);
  insert into public.email_verification_receipts(token_hash,user_id) values(p_token_hash,v_request.user_id);
  return 'verified';
end $$;
revoke all on function public.confirm_notification_email_link(text) from public,anon,authenticated;
grant execute on function public.confirm_notification_email_link(text) to service_role;

create function public.cancel_notification_email(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(72491001);
  delete from public.email_verification_requests where user_id=p_user_id;
end $$;
revoke all on function public.cancel_notification_email(uuid) from public,anon,authenticated;
grant execute on function public.cancel_notification_email(uuid) to service_role;
commit;
