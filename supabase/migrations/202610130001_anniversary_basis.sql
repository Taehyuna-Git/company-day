begin;
alter table public.anniversary_catalog add column if not exists basis text not null default 'official'
  check (basis in ('official','incorporation'));
-- Patch only the item payload, retaining the installed recipient verification,
-- limits, permissions, locking and idempotency logic from earlier migrations.
do $migration$
declare definition text; replacement text;
begin
  definition := pg_get_functiondef('public.reserve_anniversary_mail(uuid)'::regprocedure);
  if position('''basis'',c.basis' in definition)=0 then
    replacement := replace(definition, '''name'',c.name,', '''name'',c.name,''basis'',c.basis,');
    if replacement=definition then raise exception 'Anniversary payload structure changed; review before applying'; end if;
    execute replacement;
  end if;
end $migration$;
commit;
