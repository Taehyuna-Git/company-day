-- Generated from the website's confirmed anniversary catalog. Run on catalog updates.
begin;
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
delete from public.anniversary_catalog where company_id not in ('samsung-electronics','samsung-sdi','samsung-display','ecopro-bm','krx-068270','krx-017670','krx-005490','krx-005800','krx-000880','krx-002790','krx-430690','krx-234340','krx-214180');
commit;
