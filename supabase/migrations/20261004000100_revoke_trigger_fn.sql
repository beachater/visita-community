-- handle_new_user() is the sign-up trigger; nobody should call it through
-- the API (flagged by the Supabase security advisor).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
