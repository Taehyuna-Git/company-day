begin;
create table public.company_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique(user_id,id), unique(user_id,name)
);
create table public.company_follows (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id text not null check (company_id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  group_id uuid,
  anniversary_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(user_id,company_id),
  foreign key(user_id,group_id) references public.company_groups(user_id,id) on delete set null (group_id)
);
alter table public.company_groups enable row level security;
alter table public.company_follows enable row level security;
revoke all on public.company_groups,public.company_follows from anon,authenticated;
grant select,insert,update,delete on public.company_groups,public.company_follows to authenticated;
grant all on public.company_groups,public.company_follows to service_role;
create policy own_groups on public.company_groups for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_follows on public.company_follows for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index follows_group on public.company_follows(user_id,group_id);
commit;
