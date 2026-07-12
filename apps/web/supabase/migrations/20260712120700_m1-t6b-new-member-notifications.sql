-- Migration: M1 / T6b — Super-admin new-member notifications
--
-- Fires when a Member (distributor) membership is created — covers BOTH
-- self-signup (register_member) and invite-accept (accept_invitation). Inserts
-- an in-app notification for every super-admin (and the relevant district_admin,
-- if the chapter belongs to a district) and logs an activity.
--
-- No-spam: fires once per accounts_memberships INSERT; register_member is
-- idempotent per (user, org), so retries don't re-insert -> no duplicate. The
-- whole notification body is wrapped in an exception guard so a notification
-- failure can never break the critical membership insert (extend, don't break).
--
-- SCOPING: limited to account_role = 'distributor' (the "Member" tier) to avoid
-- noise from org_admin/merchant setup. // REVIEW if other roles should notify.

create or replace function public.trigger_notify_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_name text;
  v_org_name text;
  v_district_id uuid;
  v_body text;
  v_rec record;
begin
  if new.account_role <> 'distributor' then
    return new;
  end if;

  begin
    select coalesce(a.name, a.email, 'A new member')
      into v_member_name
      from public.accounts a
     where a.primary_owner_user_id = new.user_id
       and a.is_personal_account = true;

    select name into v_org_name from public.accounts where id = new.account_id;

    select op.district_id into v_district_id
      from public.organization_profiles op
     where op.account_id = new.account_id;

    v_body := coalesce(v_member_name, 'A new member')
              || ' joined ' || coalesce(v_org_name, 'an organization');

    -- Notify every super-admin (recipient = their personal account).
    for v_rec in
      select a.id as account_id
        from public.accounts a
        join auth.users u on u.id = a.primary_owner_user_id
       where a.is_personal_account = true
         and (u.raw_app_meta_data ->> 'role') = 'super-admin'
    loop
      insert into public.notifications (account_id, type, body, link)
      values (v_rec.account_id, 'info', v_body, '/dashboard');
    end loop;

    -- Notify the district_admin(s) of the chapter's district, if any.
    if v_district_id is not null then
      for v_rec in
        select dm.account_id
          from public.district_memberships dm
         where dm.district_id = v_district_id
      loop
        insert into public.notifications (account_id, type, body, link)
        values (v_rec.account_id, 'info', v_body, '/dashboard');
      end loop;
    end if;

    -- Activity log (mirrors existing trigger_log_* pattern).
    perform public.log_activity(
      'distributor_added'::public.activity_type,
      v_body,
      new.user_id,
      new.account_id,
      'membership',
      new.account_id,
      jsonb_build_object('district_id', v_district_id, 'role', new.account_role)
    );
  exception when others then
    -- Never let a notification/logging failure break the membership insert.
    raise warning 'trigger_notify_new_member failed: %', sqlerrm;
  end;

  return new;
end;
$$;

create trigger notify_new_member_after_insert
after insert on public.accounts_memberships
for each row execute function public.trigger_notify_new_member();
