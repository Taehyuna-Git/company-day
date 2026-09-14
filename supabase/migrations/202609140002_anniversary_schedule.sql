begin;
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
