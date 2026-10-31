begin;
-- A fresh opt-in avoids activating a previously unfinished news checkbox.
alter table public.notification_preferences add column news_digest_enabled boolean not null default false;
grant update(news_digest_enabled) on public.notification_preferences to authenticated;
create table public.news_mail_settings(id boolean primary key default true check(id), enabled boolean not null default true);
insert into public.news_mail_settings(id) values(true);
create table public.news_feed_cache(company_id text primary key, articles jsonb not null default '[]', checked_at timestamptz, refreshed_at timestamptz, retry_after timestamptz not null default now());
create table public.news_mail_jobs(
 id uuid primary key references public.email_delivery_logs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 delivery_key text not null unique, recipient text not null, payload jsonb not null,
 status text not null default 'reserved' check(status in ('reserved','sent','failed','uncertain','skipped')),
 created_at timestamptz not null default now(), finished_at timestamptz
);
create table public.news_mail_seen(user_id uuid references auth.users(id) on delete cascade, fingerprint text not null, created_at timestamptz not null default now(), primary key(user_id,fingerprint));
create index news_jobs_owner on public.news_mail_jobs(user_id,created_at desc);
create index news_seen_expiry on public.news_mail_seen(created_at);
alter table public.news_mail_settings enable row level security;
alter table public.news_feed_cache enable row level security;
alter table public.news_mail_jobs enable row level security;
alter table public.news_mail_seen enable row level security;
revoke all on public.news_mail_settings,public.news_feed_cache,public.news_mail_jobs,public.news_mail_seen from public,anon,authenticated;
grant all on public.news_mail_settings,public.news_feed_cache,public.news_mail_jobs,public.news_mail_seen to service_role;
grant select(id,user_id,status,created_at,finished_at) on public.news_mail_jobs to authenticated;
create policy own_news_jobs on public.news_mail_jobs for select to authenticated using ((select auth.uid())=user_id);

create function public.claim_news_feeds(p_user uuid default null) returns table(company_id text)
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(72491002);
 if not exists(select 1 from public.news_mail_settings where enabled) then return; end if;
 insert into public.news_feed_cache(company_id)
 select distinct f.company_id from public.company_follows f
 join public.notification_preferences p on p.user_id=f.user_id
 join public.notification_emails e on e.user_id=f.user_id
 where (p_user is null and p.news_digest_enabled) or (p_user is not null and f.user_id=p_user)
 on conflict do nothing;
 return query with candidates as (
 select c.company_id from public.news_feed_cache c where c.retry_after<=now() and exists(
 select 1 from public.company_follows f join public.notification_preferences p on p.user_id=f.user_id
 where f.company_id=c.company_id and ((p_user is null and p.news_digest_enabled) or f.user_id=p_user))
 order by c.checked_at nulls first,c.company_id limit 8 for update skip locked
 ) update public.news_feed_cache c set retry_after=now()+interval '10 minutes' from candidates x where c.company_id=x.company_id returning c.company_id;
end $$;

create function public.news_digest_items(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by (item->>'important')::boolean desc,(item->>'publishedAt')::timestamptz desc),'[]'::jsonb) from (
 select distinct on (item->>'fingerprint') item from public.company_follows f
 join public.news_feed_cache c on c.company_id=f.company_id and c.refreshed_at>now()-interval '24 hours'
 cross join lateral jsonb_array_elements(c.articles) item
 where f.user_id=p_user and (item->>'publishedAt')::timestamptz>now()-interval '72 hours'
 and not exists(select 1 from public.news_mail_seen s where s.user_id=p_user and s.fingerprint=item->>'fingerprint')
 order by item->>'fingerprint',(item->>'publishedAt')::timestamptz desc
 ) distinct_items
$$;

create function public.preview_news_digest(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('items',coalesce((select jsonb_agg(item) from (select item from jsonb_array_elements(public.news_digest_items(p_user)) item limit 15) q),'[]'::jsonb),
 'pending',(select count(*) from public.company_follows f left join public.news_feed_cache c on c.company_id=f.company_id where f.user_id=p_user and (c.checked_at is null or c.checked_at<now()-interval '24 hours')))
$$;

create function public.reserve_news_mail() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_email text; v_items jsonb; v_id uuid:=gen_random_uuid(); v_today date:=(now() at time zone 'Asia/Seoul')::date;
begin
 perform pg_catalog.pg_advisory_xact_lock(72491001);
 if not exists(select 1 from public.news_mail_settings where enabled) then return null; end if;
 -- Receipt retention exceeds the 72-hour article window.
 delete from public.news_mail_seen where created_at<now()-interval '8 days';
 select p.user_id,e.email,public.news_digest_items(p.user_id) into v_user,v_email,v_items
 from public.notification_preferences p join public.notification_emails e on e.user_id=p.user_id
 join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null
 where p.news_digest_enabled and p.send_hour<=extract(hour from now() at time zone 'Asia/Seoul')
 and not exists(select 1 from public.news_mail_jobs j where j.delivery_key=p.user_id||':'||v_today)
 and not exists(select 1 from public.company_follows f left join public.news_feed_cache c on c.company_id=f.company_id where f.user_id=p.user_id and (c.checked_at is null or c.checked_at<now()-interval '24 hours'))
 and jsonb_array_length(public.news_digest_items(p.user_id))>0
 order by p.user_id limit 1;
 if not found then return null; end if;
 if (select count(*) from public.email_delivery_logs where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=70 then raise exception 'daily_budget'; end if;
 if (select count(*) from public.email_delivery_logs where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')>=2000 then raise exception 'monthly_budget'; end if;
 select jsonb_agg(item) into v_items from (select item from jsonb_array_elements(v_items) item limit 15) q;
 insert into public.email_delivery_logs(id,user_id,kind) values(v_id,v_user,'news');
 insert into public.news_mail_jobs(id,user_id,delivery_key,recipient,payload) values(v_id,v_user,v_user||':'||v_today,v_email,jsonb_build_object('items',v_items,'date',v_today));
 -- Reserve fingerprints before SMTP. Ambiguous delivery is never automatically retried.
 insert into public.news_mail_seen(user_id,fingerprint) select v_user,item->>'fingerprint' from jsonb_array_elements(v_items) item on conflict do nothing;
 return (select to_jsonb(j) from public.news_mail_jobs j where id=v_id);
end $$;
create function public.finish_news_mail(p_id uuid,p_status text,p_provider_id text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','failed','uncertain','skipped') then raise exception 'invalid_status'; end if;
 update public.news_mail_jobs set status=p_status,finished_at=now() where id=p_id and status='reserved';
 if found then update public.email_delivery_logs set status=case when p_status='sent' then 'sent' else 'failed' end,provider_id=p_provider_id where id=p_id; end if;
end $$;
revoke all on function public.claim_news_feeds(uuid),public.news_digest_items(uuid),public.preview_news_digest(uuid),public.reserve_news_mail(),public.finish_news_mail(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_news_feeds(uuid),public.news_digest_items(uuid),public.preview_news_digest(uuid),public.reserve_news_mail(),public.finish_news_mail(uuid,text,text) to service_role;
commit;
