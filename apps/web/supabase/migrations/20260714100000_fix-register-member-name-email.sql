-- Migration: capture name + email in self-signup (register_member)
--
-- The campus /join/start flow never recorded the member's name, so
-- accounts.name was blank -> they showed with no name in the distributor lists
-- and as "Member" on the leaderboard (public_display_name(null) = 'Member').
-- register_member now also records name and email on the member's personal
-- account, matching what the invite path already does.

drop function if exists public.register_member(uuid, text);

create or replace function public.register_member(
  p_org_account_id uuid,
  p_phone text default null,
  p_name text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_recent_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_profiles op
    where op.account_id = p_org_account_id
      and op.is_active
      and op.district_id is not null
  ) then
    raise exception 'Invalid or inactive organization' using errcode = '22023';
  end if;

  select count(*)
    into v_recent_count
  from public.accounts_memberships
  where user_id = v_user_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'Too many signups, please try again later' using errcode = '54000';
  end if;

  if not exists (
    select 1
    from public.accounts_memberships
    where user_id = v_user_id
      and account_id = p_org_account_id
  ) then
    insert into public.accounts_memberships (user_id, account_id, account_role)
    values (v_user_id, p_org_account_id, 'distributor');
  end if;

  -- Record name/email/phone on the member's personal account. These surface via
  -- distributors_view (name) and public_display_name (leaderboard). Only
  -- overwrite when a non-empty value is supplied.
  --
  -- SECURITY DEFINER runs as the function owner, so kit.protect_account_fields
  -- (which only blocks updates when current_user is 'authenticated'/'anon') does
  -- not block the email write.
  -- REVIEW: accounts.email is normally synced from auth.users.email; for a
  -- phone-only signup that stays null, so we store the collected email here.
  update public.accounts
     set phone = coalesce(nullif(btrim(p_phone), ''), phone),
         name  = coalesce(nullif(btrim(p_name), ''), name),
         email = coalesce(nullif(btrim(p_email), ''), email)
   where primary_owner_user_id = v_user_id
     and is_personal_account = true;

  return p_org_account_id;
end;
$$;

grant execute on function public.register_member(uuid, text, text, text) to authenticated;

comment on function public.register_member(uuid, text, text, text) is
  'Self-signup: grants the authenticated (phone-verified) user a distributor membership on the chosen chapter and records their name/email/phone. Rate-limited; idempotent per (user, org).';
