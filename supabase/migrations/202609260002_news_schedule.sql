begin;
select cron.schedule('companyday-news-mail','2-59/5 * * * *',$cron$
 select net.http_post(
 url:='https://gnnrlkxplhwyqufoapuv.supabase.co/functions/v1/anniversary-mail/news',
 headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='companyday_anniversary_scheduler')),
 body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=100000
 ) where exists(select 1 from public.news_mail_settings where enabled);
$cron$);
commit;
