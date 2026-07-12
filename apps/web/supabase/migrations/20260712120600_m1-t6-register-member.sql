-- Migration: M1 / T6 — Member self-signup: register_member RPC
--
-- Grants the CURRENT (already email-verified) user a distributor ("Member")
-- membership on a chosen chapter, and stores their phone. Mirrors the
-- accept_invitation membership-grant path, but self-initiated.
--
-- DESIGN NOTE (deliberate, flagged): the ticket says the RPC should "create/
-- attach the auth user". Creating auth.users rows from SQL bypasses GoTrue
-- (password/identity/email handling) and is unsafe. Instead the FRONTEND
-- verifies the email via the existing OTP sign-in (use-sign-in-with-otp ->
-- GoTrue), which creates/authenticates the user; this RPC then runs as that
-- authenticated user and only grants membership + stores phone. Being
-- authenticated (auth.uid() not null) IS the "verified before granting" gate,
-- so no separate nonce is required. // REVIEW if a distinct nonce is desired.
--
-- Twilio is not wired yet, so verification is EMAIL OTP for now; phone is stored
-- as a field for the M5 phone-OTP upgrade.

create or replace function public.register_member(
  p_org_account_id uuid,
  p_phone text default null
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
  -- Must be authenticated: the email OTP sign-in must have completed first.
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Target must be a real, ACTIVE organization that belongs to a district
  -- (self-signup is for campus/chapter members).
  if not exists (
    select 1
    from public.organization_profiles op
    where op.account_id = p_org_account_id
      and op.is_active
      and op.district_id is not null
  ) then
    raise exception 'Invalid or inactive organization' using errcode = '22023';
  end if;

  -- Rate-limit: cap self-joins per user in a short window (abuse guard).
  select count(*)
    into v_recent_count
  from public.accounts_memberships
  where user_id = v_user_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'Too many signups, please try again later' using errcode = '54000';
  end if;

  -- Idempotent: if already a member of this org, just refresh phone and return.
  if not exists (
    select 1
    from public.accounts_memberships
    where user_id = v_user_id
      and account_id = p_org_account_id
  ) then
    insert into public.accounts_memberships (user_id, account_id, account_role)
    values (v_user_id, p_org_account_id, 'distributor');
  end if;

  -- Store phone on the user's personal account (surfaced via distributors_view).
  if p_phone is not null and length(trim(p_phone)) > 0 then
    update public.accounts
       set phone = p_phone
     where primary_owner_user_id = v_user_id
       and is_personal_account = true;
  end if;

  return p_org_account_id;
end;
$$;

grant execute on function public.register_member(uuid, text) to authenticated;

comment on function public.register_member(uuid, text) is
  'Self-signup: grants the authenticated (email-verified) user a distributor membership on the chosen chapter and stores phone. Rate-limited; idempotent per (user, org).';
