-- Migration: M3 / P0-2 — Get Started "No" path: general signup
--
-- A user who answers "No" to "Are you on a campus?" completes phone-OTP signup
-- WITHOUT a campus/chapter. GoTrue creates the auth user (a plain cardholder,
-- no membership) via the frontend OTP flow; this RPC then, as that authenticated
-- user, stores their name and NOTIFIES super-admins. They also surface in the
-- Users list (Cardholders tab) automatically since they have no membership.
--
-- Never dead-ends: the "No" path lands on a working signup, not a message.

create or replace function public.register_general_signup(
  p_name text,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_body text;
  v_rec record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Store the entered name on the user's personal account.
  if p_name is not null and length(btrim(p_name)) > 0 then
    update public.accounts
       set name = p_name
     where primary_owner_user_id = v_user_id
       and is_personal_account = true;
  end if;

  -- Notify super-admins (guarded so a notification failure never breaks signup).
  begin
    v_body := coalesce(nullif(btrim(p_name), ''), 'A new user')
              || ' signed up (no campus)'
              || case
                   when p_email is not null and length(btrim(p_email)) > 0
                   then ' — ' || btrim(p_email)
                   else ''
                 end;

    for v_rec in
      select a.id as account_id
      from public.accounts a
      join auth.users u on u.id = a.primary_owner_user_id
      where a.is_personal_account = true
        and (u.raw_app_meta_data ->> 'role') = 'super-admin'
    loop
      insert into public.notifications (account_id, type, body, link)
      values (v_rec.account_id, 'info', v_body, '/dashboard/entities?tab=cardholders');
    end loop;
  exception when others then
    raise warning 'register_general_signup notify failed: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.register_general_signup(text, text) to authenticated;
