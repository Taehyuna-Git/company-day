-- Official history: https://www.yangjisa.com/eng/about/history_museum.asp
-- Startup anniversary only; conflicting legal incorporation dates remain unknown.
-- Applied to production on 2026-10-12. Do not overwrite a conflicting saved date.
insert into public.anniversary_catalog(company_id,name,anniversary)
values ('krx-030960','양지사','1976-09-01')
on conflict(company_id) do update set name=excluded.name,anniversary=excluded.anniversary
where anniversary_catalog.anniversary is null or anniversary_catalog.anniversary=excluded.anniversary;
