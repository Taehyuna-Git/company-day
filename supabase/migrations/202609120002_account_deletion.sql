begin;
-- No user id parameter: only the authenticated caller can remove their account.
create function public.delete_my_account() returns void language plpgsql security definer set search_path='' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'authentication_required'; end if;
  delete from public.email_delivery_logs where user_id=caller;
  delete from auth.users where id=caller;
end $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;
commit;
