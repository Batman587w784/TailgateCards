-- Migration: M1 / T7 — Reassign a member between chapters
--
-- Moves a member (distributor) from one chapter to another in one action, with
-- an optional "move sales too" toggle. Authorized to super-admin, or a
-- district_admin whose district contains BOTH chapters.
--
-- Membership move = delete old (user, from_org) + insert (user, to_org) because
-- accounts_memberships forbids updating account_id (prevent_memberships_update).
--
-- // REVIEW (golden rule — DEFERRED): "move sales too" is intentionally NOT
-- implemented. Re-attributing a member's cards to the new chapter means changing
-- cards.organization_id, which (a) violates cards_org_digital_number_uniq /
-- per-org card numbering (verified: hit a duplicate-key error in testing), and
-- (b) touches the card lifecycle the golden rule forbids. Doing it safely needs
-- per-destination-org renumbering + org card counters + revenue-share review —
-- a dedicated task. So p_move_sales=true raises a clear error for now; the
-- membership move still works. The UI should disable the toggle until this is
-- designed. Note: the new membership INSERT fires the T6b "new member"
-- notification (a reassignment surfaces as a join under the new chapter).

create or replace function public.reassign_member(
  p_user_id uuid,
  p_from_org uuid,
  p_to_org uuid,
  p_move_sales boolean default false
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_account_id uuid;
  v_moved_cards int := 0;
begin
  if p_from_org = p_to_org then
    raise exception 'Source and destination chapters are the same' using errcode = '22023';
  end if;

  -- DEFERRED: see the // REVIEW header. Re-attributing cards across chapters
  -- collides with per-org card numbering and touches card lifecycle.
  if p_move_sales then
    raise exception 'MOVE_SALES_NOT_SUPPORTED: reassigning a member''s sales across chapters is not yet supported (needs per-chapter card renumbering); reassign the member without moving sales'
      using errcode = '0A000';
  end if;

  -- Authorization: super-admin, or a district_admin of BOTH chapters' district.
  if not (
    public.is_super_admin()
    or (public.org_in_my_district(p_from_org) and public.org_in_my_district(p_to_org))
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Destination must be a real, active organization in a district.
  if not exists (
    select 1 from public.organization_profiles op
    where op.account_id = p_to_org and op.is_active and op.district_id is not null
  ) then
    raise exception 'Invalid or inactive destination chapter' using errcode = '22023';
  end if;

  -- The member must currently be a distributor on the source chapter.
  if not exists (
    select 1 from public.accounts_memberships
    where user_id = p_user_id and account_id = p_from_org and account_role = 'distributor'
  ) then
    raise exception 'Member is not a distributor on the source chapter' using errcode = '22023';
  end if;

  -- Resolve the member's personal account (cards.distributor_id points here).
  select id into v_member_account_id
  from public.accounts
  where primary_owner_user_id = p_user_id and is_personal_account = true;

  -- Move the membership (delete old + insert new; account_id is immutable).
  delete from public.accounts_memberships
  where user_id = p_user_id and account_id = p_from_org;

  if not exists (
    select 1 from public.accounts_memberships
    where user_id = p_user_id and account_id = p_to_org
  ) then
    insert into public.accounts_memberships (user_id, account_id, account_role)
    values (p_user_id, p_to_org, 'distributor');
  end if;

  perform public.log_activity(
    'distributor_added'::public.activity_type,
    'Member reassigned to a new chapter',
    p_user_id,
    p_to_org,
    'membership',
    p_to_org,
    jsonb_build_object(
      'from_org', p_from_org,
      'to_org', p_to_org,
      'moved_sales', p_move_sales,
      'moved_cards', v_moved_cards
    )
  );

  return json_build_object(
    'user_id', p_user_id,
    'from_org', p_from_org,
    'to_org', p_to_org,
    'moved_sales', p_move_sales,
    'moved_cards', v_moved_cards
  );
end;
$$;

grant execute on function public.reassign_member(uuid, uuid, uuid, boolean) to authenticated;
