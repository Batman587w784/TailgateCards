# Backfill: nameless self-signup members (one-off, run manually)

**Context.** Before `20260714100000_fix-register-member-name-email.sql`, the campus
`/join/start` flow never captured a member's name, so their `accounts.name` was
left blank. Those members show with no name in the Distributors lists and as
**"Member"** on the leaderboard. New signups are fixed going forward; this is a
one-off cleanup for members already created (e.g. prod testing accounts).

**Important:** no name was ever recorded for these members, so there is nothing to
derive a name *from* — names must be set **manually**. The only identifying data
is phone + chapter + created_at. Do NOT run this automatically.

> Run against prod yourself only when you're ready:
> `./scripts/sb prod db dump ...` first if you want a backup, then apply via a SQL
> console / `./scripts/sb prod ...`. (Claude will not run anything against prod.)

## 1. List the affected members

```sql
select
  a.id            as account_id,
  a.phone,
  a.created_at,
  op.organization_name as chapter,
  d.name          as campus
from public.accounts a
join public.accounts_memberships am
  on am.user_id = a.primary_owner_user_id
 and am.account_role = 'distributor'
left join public.organization_profiles op on op.account_id = am.account_id
left join public.districts d on d.id = op.district_id
where a.is_personal_account = true
  and (a.name is null or btrim(a.name) = '')
order by a.created_at;
```

Use `phone` / `chapter` / `created_at` to identify who each row is.

## 2. Set each member's name (and email if known)

One statement per member, filling in the real values:

```sql
update public.accounts
   set name  = 'Jane Doe',              -- required
       email = 'jane@example.com'       -- optional; omit this line if unknown
 where id = '00000000-0000-0000-0000-000000000000';  -- account_id from step 1
```

Notes:
- Run these as the DB admin (postgres) or service role. `kit.protect_account_fields`
  only blocks name/email edits made by the `authenticated`/`anon` roles, so an
  admin-run `UPDATE` succeeds.
- After updating, the member immediately shows their real name in the super-admin
  Distributors tab, the org-admin distributor list, and as first-name + last
  initial on `/dashboard/leaderboard`.

<!-- REVIEW: if you'd rather fix these from the UI, add a `name` field to the
     distributor edit modal (UpdateDistributorSchema + admin-entities.service +
     distributor-details-modal) — accounts.name is editable via the admin client.
     Deferred here in favor of the documented snippet you asked for. -->
