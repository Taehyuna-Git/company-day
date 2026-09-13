begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name)<=80),
  timezone text not null default 'Asia/Seoul' check (timezone='Asia/Seoul'),
  created_at timestamptz not null default now()
);
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  anniversary_enabled boolean not null default false,
  news_enabled boolean not null default false,
  lead_days integer[] not null default '{0,1,3}' check (lead_days <@ array[0,1,3,7] and cardinality(lead_days) between 1 and 4),
  send_hour integer not null default 9 check (send_hour between 0 and 23),
  updated_at timestamptz not null default now()
);
create table public.notification_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  verified_at timestamptz not null default now()
);
create table public.email_verification_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  token_hash text not null check (length(token_hash)=64),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  request_id uuid not null unique
);
create table public.email_delivery_logs (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('verification','anniversary','news')),
  status text not null default 'reserved' check (status in ('reserved','sent','failed')),
  provider_id text,
  created_at timestamptz not null default now()
);
create index email_delivery_created on public.email_delivery_logs(created_at);
create index email_delivery_user on public.email_delivery_logs(user_id,created_at);

alter table public.profiles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_emails enable row level security;
alter table public.email_verification_requests enable row level security;
alter table public.email_delivery_logs enable row level security;
revoke all on public.profiles,public.notification_preferences,public.notification_emails,public.email_verification_requests,public.email_delivery_logs from anon,authenticated;
grant select on public.profiles,public.notification_preferences,public.notification_emails to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(anniversary_enabled,news_enabled,lead_days,send_hour) on public.notification_preferences to authenticated;
grant select(user_id,email,created_at,expires_at) on public.email_verification_requests to authenticated;
grant all on public.profiles,public.notification_preferences,public.notification_emails,public.email_verification_requests,public.email_delivery_logs to service_role;
create policy profile_read on public.profiles for select to authenticated using ((select auth.uid())=user_id);
create policy profile_edit on public.profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy preferences_read on public.notification_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy preferences_edit on public.notification_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy email_read on public.notification_emails for select to authenticated using ((select auth.uid())=user_id);
create policy pending_read on public.email_verification_requests for select to authenticated using ((select auth.uid())=user_id);

create function public.initialize_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id) values(new.id) on conflict do nothing;
  insert into public.notification_preferences(user_id) values(new.id) on conflict do nothing;
  if new.email_confirmed_at is not null and new.email is not null then
    -- A later login-email change never silently replaces a separately chosen recipient.
    insert into public.notification_emails(user_id,email,verified_at) values(new.id,new.email,new.email_confirmed_at) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.initialize_account() from public,anon,authenticated;
create trigger account_created after insert or update of email_confirmed_at on auth.users for each row execute function public.initialize_account();
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;
insert into public.notification_preferences(user_id) select id from auth.users on conflict do nothing;
insert into public.notification_emails(user_id,email,verified_at) select id,email,email_confirmed_at from auth.users where email_confirmed_at is not null and email is not null on conflict do nothing;

-- Conservative allowance for application emails, leaving room for Auth mail.
-- Reserved and failed sends count too; concurrent calls cannot overspend the allowance.
create function public.request_notification_email(p_user_id uuid,p_email text,p_token_hash text,p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=now();
begin
  perform pg_catalog.pg_advisory_xact_lock(72491001);
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then raise exception 'verified_account_required'; end if;
  if exists(select 1 from public.email_delivery_logs where user_id=p_user_id and kind='verification' and created_at>v_now-interval '60 seconds') then raise exception 'cooldown'; end if;
  if (select count(*) from public.email_delivery_logs where user_id=p_user_id and kind='verification' and created_at>v_now-interval '24 hours')>=5 then raise exception 'user_daily_limit'; end if;
  if (select count(*) from public.email_delivery_logs where created_at>=date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC')>=70 then raise exception 'daily_budget'; end if;
  if (select count(*) from public.email_delivery_logs where created_at>=date_trunc('month',v_now at time zone 'UTC') at time zone 'UTC')>=2000 then raise exception 'monthly_budget'; end if;
  insert into public.email_delivery_logs(id,user_id,kind) values(p_request_id,p_user_id,'verification');
  insert into public.email_verification_requests(user_id,email,token_hash,expires_at,request_id)
    values(p_user_id,p_email,p_token_hash,v_now+interval '30 minutes',p_request_id)
    on conflict(user_id) do update set email=excluded.email,token_hash=excluded.token_hash,created_at=v_now,expires_at=excluded.expires_at,request_id=excluded.request_id;
end $$;
revoke all on function public.request_notification_email(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.request_notification_email(uuid,text,text,uuid) to service_role;

create function public.confirm_notification_email(p_user_id uuid,p_token_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare v_request public.email_verification_requests%rowtype;
begin
  select * into v_request from public.email_verification_requests where user_id=p_user_id for update;
  if not found or v_request.expires_at<=now() or v_request.token_hash<>p_token_hash then raise exception 'invalid_or_expired_token'; end if;
  insert into public.notification_emails(user_id,email,verified_at) values(p_user_id,v_request.email,now())
    on conflict(user_id) do update set email=excluded.email,verified_at=excluded.verified_at;
  delete from public.email_verification_requests where user_id=p_user_id;
end $$;
revoke all on function public.confirm_notification_email(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_notification_email(uuid,text) to service_role;
commit;
