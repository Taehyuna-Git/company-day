-- Apply once to the existing company-day Supabase project. No secrets are returned.
begin;
create table public.anniversary_catalog (
  company_id text primary key, name text not null, anniversary date not null
);
alter table public.anniversary_catalog enable row level security;
revoke all on public.anniversary_catalog from public,anon,authenticated;
grant all on public.anniversary_catalog to service_role;

create table public.anniversary_mail_settings (
  id boolean primary key default true check(id), enabled boolean not null default false
);
insert into public.anniversary_mail_settings(id) values(true);
alter table public.anniversary_mail_settings enable row level security;
revoke all on public.anniversary_mail_settings from public,anon,authenticated;
grant select,update on public.anniversary_mail_settings to service_role;

create table public.anniversary_mail_jobs (
  id uuid primary key references public.email_delivery_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_key text not null unique,
  kind text not null check(kind in ('test','anniversary')),
  recipient text not null,
  payload jsonb not null,
  status text not null default 'reserved' check(status in ('reserved','sent','failed','uncertain','skipped')),
  created_at timestamptz not null default now(), finished_at timestamptz
);
create index anniversary_mail_owner on public.anniversary_mail_jobs(user_id,created_at desc);
alter table public.anniversary_mail_jobs enable row level security;
revoke all on public.anniversary_mail_jobs from public,anon,authenticated;
grant select(id,user_id,kind,status,created_at,finished_at) on public.anniversary_mail_jobs to authenticated;
grant all on public.anniversary_mail_jobs to service_role;
create policy own_mail_jobs on public.anniversary_mail_jobs for select to authenticated using ((select auth.uid())=user_id);

-- Match the site's annual recurrence: Feb 29 becomes March 1 in non-leap years.
create function public.next_anniversary(p_date date,p_today date) returns date
language sql immutable set search_path='' as $$
  select case when d>=p_today then d else
    (make_date(extract(year from p_today)::int+1,extract(month from p_date)::int,1)+extract(day from p_date)::int-1) end
  from (select make_date(extract(year from p_today)::int,extract(month from p_date)::int,1)+extract(day from p_date)::int-1 as d) q
$$;
revoke all on function public.next_anniversary(date,date) from public,anon,authenticated;
grant execute on function public.next_anniversary(date,date) to service_role;

create function public.reserve_anniversary_mail(p_test_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_now timestamptz:=now(); v_today date:=(now() at time zone 'Asia/Seoul')::date;
  v_hour int:=extract(hour from now() at time zone 'Asia/Seoul');
  v_user uuid; v_email text; v_items jsonb; v_id uuid:=gen_random_uuid(); v_key text;
begin
  -- Shared with address-verification emails, including failures/reservations.
  perform pg_catalog.pg_advisory_xact_lock(72491001);
  if p_test_user is null and not exists(select 1 from public.anniversary_mail_settings where enabled) then return null; end if;
  if p_test_user is not null then
    select u.id,e.email into v_user,v_email from auth.users u join public.notification_emails e on e.user_id=u.id
      where u.id=p_test_user and u.email_confirmed_at is not null;
    if not found then raise exception 'verified_recipient_required'; end if;
    if exists(select 1 from public.anniversary_mail_jobs where user_id=v_user and kind='test' and created_at>v_now-interval '60 seconds') then raise exception 'cooldown'; end if;
    if (select count(*) from public.anniversary_mail_jobs where user_id=v_user and kind='test' and created_at>v_now-interval '24 hours')>=3 then raise exception 'test_daily_limit'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',c.company_id,'name',c.name,'date',n.d,'days',n.d-v_today,'age',extract(year from n.d)::int-extract(year from c.anniversary)::int) order by n.d,c.name),'[]'::jsonb)
      into v_items from public.company_follows f join public.anniversary_catalog c on c.company_id=f.company_id
      cross join lateral(select public.next_anniversary(c.anniversary,v_today) d) n where f.user_id=v_user;
    v_key:='test:'||v_id;
  else
    select p.user_id,e.email,jsonb_agg(jsonb_build_object('id',c.company_id,'name',c.name,'date',n.d,'days',n.d-v_today,'age',extract(year from n.d)::int-extract(year from c.anniversary)::int) order by n.d,c.name)
      into v_user,v_email,v_items
      from public.notification_preferences p
      join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
      join public.notification_emails e on e.user_id=p.user_id
      join public.company_follows f on f.user_id=p.user_id and f.anniversary_enabled
      join public.anniversary_catalog c on c.company_id=f.company_id
      cross join lateral(select public.next_anniversary(c.anniversary,v_today) d) n
      where p.anniversary_enabled and p.send_hour<=v_hour and (n.d-v_today)=any(p.lead_days)
      and not exists(select 1 from public.anniversary_mail_jobs j where j.delivery_key='anniversary:'||p.user_id||':'||v_today)
      group by p.user_id,e.email order by p.user_id limit 1;
    if not found then return null; end if;
    v_key:='anniversary:'||v_user||':'||v_today;
  end if;
  if (select count(*) from public.email_delivery_logs where created_at>=date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC')>=70 then raise exception 'daily_budget'; end if;
  if (select count(*) from public.email_delivery_logs where created_at>=date_trunc('month',v_now at time zone 'UTC') at time zone 'UTC')>=2000 then raise exception 'monthly_budget'; end if;
  insert into public.email_delivery_logs(id,user_id,kind) values(v_id,v_user,'anniversary');
  insert into public.anniversary_mail_jobs(id,user_id,delivery_key,kind,recipient,payload)
    values(v_id,v_user,v_key,case when p_test_user is null then 'anniversary' else 'test' end,v_email,jsonb_build_object('items',v_items,'date',v_today));
  return (select to_jsonb(j) from public.anniversary_mail_jobs j where id=v_id);
end $$;
revoke all on function public.reserve_anniversary_mail(uuid) from public,anon,authenticated;
grant execute on function public.reserve_anniversary_mail(uuid) to service_role;

create function public.finish_anniversary_mail(p_id uuid,p_status text,p_provider_id text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('sent','failed','uncertain','skipped') then raise exception 'invalid_status'; end if;
  update public.anniversary_mail_jobs set status=p_status,finished_at=now() where id=p_id and status='reserved';
  if found then update public.email_delivery_logs set status=case when p_status='sent' then 'sent' else 'failed' end,provider_id=p_provider_id where id=p_id; end if;
end $$;
revoke all on function public.finish_anniversary_mail(uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_anniversary_mail(uuid,text,text) to service_role;


-- Generated from the website's confirmed anniversary catalog. Run on catalog updates.
insert into public.anniversary_catalog(company_id,name,anniversary) values
('samsung-electronics','삼성전자','1969-11-01'),
('samsung-sdi','삼성SDI','1970-07-01'),
('samsung-display','삼성디스플레이','2012-07-01'),
('ecopro-bm','에코프로비엠','2016-05-01'),
('krx-068270','셀트리온','2002-02-26'),
('krx-017670','SK텔레콤','1984-03-29'),
('krx-005490','POSCO홀딩스','1968-04-01'),
('krx-005800','신영와코루','1954-10-21'),
('krx-000880','한화','1952-10-09'),
('krx-002790','아모레퍼시픽홀딩스','1945-09-05'),
('krx-430690','한싹','1992-07-01'),
('krx-234340','헥토파이낸셜','2000-10-09'),
('krx-214180','헥토이노베이션','2009-03-19')
on conflict(company_id) do update set name=excluded.name,anniversary=excluded.anniversary;


create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- Scheduler credential stays in Vault; never export it to the browser or repository.
do $$ begin
  if not exists(select 1 from vault.secrets where name='companyday_anniversary_scheduler') then
    perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'companyday_anniversary_scheduler');
  end if;
end $$;
create function public.check_anniversary_scheduler(p_token text) returns boolean
language sql security definer set search_path='' as $$
  select length(p_token)=72 and exists(select 1 from vault.decrypted_secrets where name='companyday_anniversary_scheduler' and decrypted_secret=p_token)
$$;
revoke all on function public.check_anniversary_scheduler(text) from public,anon,authenticated;
grant execute on function public.check_anniversary_scheduler(text) to service_role;
select cron.schedule('companyday-anniversary-mail','*/5 * * * *',$cron$
  select net.http_post(
    url:='https://gnnrlkxplhwyqufoapuv.supabase.co/functions/v1/anniversary-mail',
    headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='companyday_anniversary_scheduler')),
    body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=100000
  ) where exists(select 1 from public.anniversary_mail_settings where enabled);
$cron$);


commit;
